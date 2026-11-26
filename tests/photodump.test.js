import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import sharp from 'sharp'
import { createPhotodumpHandler } from '../api/photodump.js'

const env = { PHOTODUMP_UPDATE_TOKEN: 'photodump-test-secret-'.repeat(3), BLOB_READ_WRITE_TOKEN: 'test-blob' }
const jpeg = await sharp({ create: { width: 4, height: 3, channels: 3, background: 'red' } }).jpeg().withMetadata().toBuffer()
const body = { imageBase64: jpeg.toString('base64'), capturedAt: '2026-11-26T09:00:00Z', latitude: 31.234567, longitude: 121.478912 }
const headers = { authorization: `Bearer ${env.PHOTODUMP_UPDATE_TOKEN}`, 'content-type': 'application/json' }
async function request(options = {}) {
  const req = options.chunks ? Readable.from(options.chunks) : { body: options.body === undefined ? body : options.body }
  Object.assign(req, { method: options.method || 'POST', url: options.url || '/api/photodump', headers: options.headers || headers })
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v }, status(v) { this.statusCode = v; return this }, json(v) { this.body = v; return this }, end(v) { this.body = v; return this } }
  const store = { save: async () => {}, list: async () => ({ photos: [], cursor: null }), image: async () => jpeg, remove: async () => {}, ...options.store }
  await createPhotodumpHandler({ env: options.env || env, store })(req, res)
  return res
}

test('upload strips metadata, rounds stored coordinates and returns stable id', async () => {
  let saved
  const res = await request({ store: { save: async (...args) => { saved = args } } })
  assert.equal(res.statusCode, 200)
  assert.match(res.body.id, /^[a-f0-9]{64}$/)
  assert.equal(saved[2].latitude, 31.23)
  assert.equal(saved[2].longitude, 121.48)
  assert.equal(saved[3], env.BLOB_READ_WRITE_TOKEN)
  const metadata = await sharp(saved[1]).metadata()
  assert.equal(metadata.exif, undefined)
  assert.equal(metadata.icc, undefined)
  assert.equal((await request()).body.id, res.body.id)
})

test('streamed JSON and missing coordinates work', async () => {
  const { latitude, longitude, ...withoutLocation } = body
  const res = await request({ chunks: [JSON.stringify(withoutLocation)] })
  assert.equal(res.statusCode, 200)
  assert.equal(Object.hasOwn(res.body, 'latitude'), false)
})

test('large base64 input is parsed without recursive regular expression failure', async () => {
  const large = Buffer.concat([jpeg, Buffer.alloc(1024 * 1024)])
  assert.equal((await request({ body: { ...body, imageBase64: large.toString('base64') } })).statusCode, 200)
  const oversized = Buffer.concat([jpeg, Buffer.alloc(2 * 1024 * 1024)])
  assert.equal((await request({ body: { ...body, imageBase64: oversized.toString('base64') } })).statusCode, 413)
})

test('writes fail closed before touching storage', async () => {
  const store = { save: () => assert.fail('write'), remove: () => assert.fail('delete') }
  for (const method of ['POST', 'DELETE']) {
    assert.equal((await request({ method, headers: { ...headers, authorization: 'Bearer wrong' }, store })).statusCode, 401)
    assert.equal((await request({ method, env: { ...env, PHOTODUMP_UPDATE_TOKEN: 'short' }, store })).statusCode, 503)
  }
  assert.equal((await request({ env: {} })).statusCode, 503)
})

test('rejects malformed, oversized and unapproved inputs', async () => {
  for (const invalid of [null, [], {}, '{', { ...body, extra: 'private' }, { ...body, imageBase64: '!!!!' }, { ...body, imageBase64: Buffer.from('not JPEG').toString('base64') }, { ...body, capturedAt: 'yesterday' }, { ...body, latitude: 91 }, { ...body, longitude: undefined }]) {
    assert.equal((await request({ body: invalid })).statusCode, 400)
  }
  assert.equal((await request({ body: { ...body, imageBase64: Buffer.from([255,216,255,1]).toString('base64') } })).statusCode, 400)
  assert.equal((await request({ headers: { ...headers, 'content-length': '4000000' } })).statusCode, 413)
  assert.equal((await request({ chunks: [' '.repeat(3_000_000)] })).statusCode, 413)
  assert.equal((await request({ headers: { ...headers, 'content-type': 'text/plain' } })).statusCode, 415)
})

test('public index projects only public fields and passes bounded pagination', async () => {
  const id = 'a'.repeat(64)
  const res = await request({ method: 'GET', url: '/api/photodump?cursor=next', store: { list: async cursor => {
    assert.equal(cursor, 'next')
    return { photos: [{ id, capturedAt: body.capturedAt, latitude: 31.234567, longitude: 121.478912, secret: 'do not return' }], cursor: 'following' }
  } } })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body.photos[0], { id, capturedAt: body.capturedAt, latitude: 31.23, longitude: 121.48, imageUrl: `/api/photodump?image=${id}` })
  assert.equal(res.body.cursor, 'following')
  assert.equal(res.headers['Cache-Control'], 'no-store')
  assert.equal((await request({ method: 'GET', url: '/api/photodump?cursor=' + 'a'.repeat(2049) })).statusCode, 400)
})

test('public image validates ids and returns only image bytes', async () => {
  const res = await request({ method: 'GET', url: '/api/photodump?image=' + 'a'.repeat(64) })
  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['Content-Type'], 'image/jpeg')
  assert.deepEqual(res.body, jpeg)
  assert.equal((await request({ method: 'GET', url: '/api/photodump?image=../secret' })).statusCode, 400)
  assert.equal((await request({ method: 'GET', url: '/api/photodump?image=' + 'a'.repeat(64), store: { image: async () => null } })).statusCode, 404)
})

test('authenticated deletion validates ids and calls storage', async () => {
  const id = 'a'.repeat(64)
  let removed
  const res = await request({ method: 'DELETE', url: '/api/photodump?id=' + id, store: { remove: async value => { removed = value } } })
  assert.equal(res.statusCode, 200)
  assert.equal(removed, id)
  assert.equal((await request({ method: 'DELETE', url: '/api/photodump?id=no' })).statusCode, 400)
})

test('storage failures reveal no diagnostics and unsupported methods are rejected', async () => {
  const res = await request({ store: { save: () => { throw Error('private token') } } })
  assert.equal(res.statusCode, 503)
  assert.deepEqual(res.body, { error: 'Photodump request failed' })
  const unsupported = await request({ method: 'PUT' })
  assert.equal(unsupported.statusCode, 405)
  assert.equal(unsupported.headers.Allow, 'GET, POST, DELETE')
})
