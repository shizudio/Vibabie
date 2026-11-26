import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createLocationHandler } from '../api/location.js'

const env = { LOCATION_UPDATE_TOKEN: 'test-secret-'.repeat(4), BLOB_READ_WRITE_TOKEN: 'test-blob-token' }
const headers = { authorization: `Bearer ${env.LOCATION_UPDATE_TOKEN}`, 'content-type': 'application/json' }

async function request({ method = 'POST', body = { city: 'Paris' }, requestHeaders = headers,
  environment = env, read = async () => ({ city: 'Tokyo', ignored: 'private metadata' }),
  write = async () => {}, chunks } = {}) {
  const req = chunks ? Readable.from(chunks) : {}
  Object.assign(req, { method, headers: requestHeaders })
  if (!chunks) req.body = body
  const res = {
    headers: {},
    setHeader(key, value) { this.headers[key] = value },
    status(code) { this.statusCode = code; return this },
    json(value) { this.body = value; return this },
  }
  await createLocationHandler({ env: environment, store: { read, write } })(req, res)
  return res
}

test('public GET exposes only the latest city and disables caching', async () => {
  const res = await request({ method: 'GET', requestHeaders: {} })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { city: 'Tokyo' })
  assert.equal(res.headers['Cache-Control'], 'no-store')
})

test('GET falls back for unconfigured or initially empty storage', async () => {
  for (const overrides of [{ environment: {} }, { read: async () => null }]) {
    const res = await request({ method: 'GET', ...overrides })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, { city: 'Beijing' })
  }
})

test('GET storage failures fail safely without leaking diagnostics', async () => {
  const res = await request({ method: 'GET', read: async () => { throw Error('secret') } })
  assert.equal(res.statusCode, 503)
  assert.deepEqual(res.body, { error: 'Location unavailable' })
})

test('POST fails closed with missing or weak configuration', async () => {
  for (const environment of [{}, { ...env, LOCATION_UPDATE_TOKEN: 'short' }, { LOCATION_UPDATE_TOKEN: env.LOCATION_UPDATE_TOKEN }]) {
    assert.equal((await request({ environment })).statusCode, 503)
  }
})

test('POST requires the exact bearer secret before accessing storage', async () => {
  for (const authorization of [undefined, 'Basic abc', 'Bearer wrong', `Bearer ${env.LOCATION_UPDATE_TOKEN}extra`]) {
    const res = await request({ requestHeaders: { ...headers, authorization }, write: () => assert.fail('unauthorized write') })
    assert.equal(res.statusCode, 401)
  }
})

test('POST normalizes and saves only the city using configured storage credentials', async () => {
  for (const [value, expected] of [['  São Paulo  ', 'São Paulo'], ['北京市', '北京市'], ['Xi’an', 'Xi’an'], ['Saint-Étienne', 'Saint-Étienne'], ['100 Mile House', '100 Mile House'], ['6th of October', '6th of October'], ['Washington, D.C.', 'Washington, D.C.']]) {
    let saved
    const res = await request({ body: { city: value }, write: async (body, token) => { saved = body; assert.equal(token, env.BLOB_READ_WRITE_TOKEN) } })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(saved, { city: expected })
    assert.deepEqual(res.body, saved)
  }
})

test('POST accepts the actual streamed JSON request used by an HTTP client', async () => {
  let saved
  const res = await request({ chunks: ['{"city":', '"London"}'], write: async body => { saved = body } })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(saved, { city: 'London' })
})

test('POST rejects non-JSON content types', async () => {
  for (const type of ['', 'text/plain', 'application/jsonp', 'multipart/form-data']) {
    assert.equal((await request({ requestHeaders: { ...headers, 'content-type': type } })).statusCode, 415)
  }
  assert.equal((await request({ requestHeaders: { ...headers, 'content-type': 'application/json; charset=utf-8' } })).statusCode, 200)
})

test('POST rejects malformed JSON, coordinates, extra fields, and non-city structures', async () => {
  const bodies = ['{', {}, null, [], { city: 'Paris', latitude: 48 }, { latitude: 48 }, '"Paris"']
  for (const body of bodies) {
    const res = await request({ body, write: () => assert.fail('invalid payload stored') })
    assert.equal(res.statusCode, 400)
  }
})

test('POST rejects markup, coordinates disguised as a city, controls, and oversized names', async () => {
  for (const city of ['<img src=x onerror=alert(1)>', '40.7128,-74.0060', 'Paris\nLondon', '', '  ', 'A'.repeat(81), 42]) {
    const res = await request({ body: { city }, write: () => assert.fail('invalid city stored') })
    assert.equal(res.statusCode, 400)
  }
})

test('POST enforces body limit for declared, parsed, raw, and chunked bodies', async () => {
  const variants = [
    { requestHeaders: { ...headers, 'content-length': '2048' } },
    { body: { city: 'A'.repeat(2048) } },
    { body: ' '.repeat(2048) },
    { chunks: [' '.repeat(800), ' '.repeat(800)] },
  ]
  for (const options of variants) {
    const res = await request({ ...options, write: () => assert.fail('oversized payload stored') })
    assert.equal(res.statusCode, 413)
  }
})

test('storage write failure does not report success or leak credentials', async () => {
  const res = await request({ write: async () => { throw Error(env.BLOB_READ_WRITE_TOKEN) } })
  assert.equal(res.statusCode, 503)
  assert.deepEqual(res.body, { error: 'Location update failed' })
})

test('unsupported methods cannot change the city', async () => {
  for (const method of ['PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
    const res = await request({ method, write: () => assert.fail('unexpected write') })
    assert.equal(res.statusCode, 405)
    assert.equal(res.headers.Allow, 'GET, POST')
  }
})
