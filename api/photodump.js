import { createHash, timingSafeEqual } from 'node:crypto'
import sharp from 'sharp'

const MAX_IMAGE = 2 * 1024 * 1024
const MAX_BODY = Math.ceil(MAX_IMAGE / 3) * 4 + 4096
const ID = /^[a-f0-9]{64}$/
class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

function authorize(header, secret) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false
  const hash = value => createHash('sha256').update(value).digest()
  return timingSafeEqual(hash(header.slice(7)), hash(secret))
}

async function bodyJSON(req) {
  if (Number(req.headers['content-length']) > MAX_BODY) throw new RequestError(413, 'Request too large')
  let body = req.body
  if (body === undefined) {
    const chunks = []
    let length = 0
    for await (const chunk of req) {
      const buffer = Buffer.from(chunk)
      length += buffer.length
      if (length > MAX_BODY) throw new RequestError(413, 'Request too large')
      chunks.push(buffer)
    }
    body = Buffer.concat(chunks)
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8')
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > MAX_BODY) throw new RequestError(413, 'Request too large')
    try { body = JSON.parse(body) } catch { throw new RequestError(400, 'Invalid JSON') }
  } else if (Buffer.byteLength(JSON.stringify(body) || '') > MAX_BODY) throw new RequestError(413, 'Request too large')
  return body
}

function parsePhoto(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['imageBase64', 'capturedAt', 'latitude', 'longitude'].includes(key))) {
    throw new RequestError(400, 'Invalid photo')
  }
  if (typeof body.imageBase64 !== 'string' || !body.imageBase64.length || body.imageBase64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(body.imageBase64)) {
    throw new RequestError(400, 'Invalid JPEG base64')
  }
  const image = Buffer.from(body.imageBase64, 'base64')
  if (image.toString('base64') !== body.imageBase64) throw new RequestError(400, 'Invalid JPEG base64')
  if (image.length > MAX_IMAGE) throw new RequestError(413, 'Image too large')
  if (image.length < 4 || image[0] !== 255 || image[1] !== 216 || image[2] !== 255) throw new RequestError(400, 'Use JPEG images')
  if (typeof body.capturedAt !== 'string' || body.capturedAt.length > 40 ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(body.capturedAt) ||
      !Number.isFinite(Date.parse(body.capturedAt))) throw new RequestError(400, 'Invalid capture date')
  const metadata = { capturedAt: new Date(body.capturedAt).toISOString() }
  if (Object.hasOwn(body, 'latitude') || Object.hasOwn(body, 'longitude')) {
    if (typeof body.latitude !== 'number' || !Number.isFinite(body.latitude) || Math.abs(body.latitude) > 90 ||
        typeof body.longitude !== 'number' || !Number.isFinite(body.longitude) || Math.abs(body.longitude) > 180) {
      throw new RequestError(400, 'Invalid coordinates')
    }
    metadata.latitude = Math.round(body.latitude * 100) / 100
    metadata.longitude = Math.round(body.longitude * 100) / 100
  }
  return { image, metadata }
}

function publicPhoto(value) {
  if (!value || !ID.test(value.id) || !Number.isFinite(Date.parse(value.capturedAt))) throw Error('Invalid stored photo')
  const result = { id: value.id, capturedAt: value.capturedAt, imageUrl: `/api/photodump?image=${value.id}` }
  if (Number.isFinite(value.latitude) && Number.isFinite(value.longitude) && Math.abs(value.latitude) <= 90 && Math.abs(value.longitude) <= 180) {
    result.latitude = Math.round(value.latitude * 100) / 100
    result.longitude = Math.round(value.longitude * 100) / 100
  }
  return result
}

const storage = {
  async list(cursor, token) {
    const { list, get } = await import('@vercel/blob')
    const page = await list({ prefix: 'photodump/records/', limit: 50, cursor, token })
    const photos = await Promise.all(page.blobs.map(async blob => {
      const record = await get(blob.pathname, { access: 'private', token, useCache: false })
      if (!record) return null
      return new Response(record.stream).json()
    }))
    return { photos: photos.filter(Boolean), cursor: page.hasMore ? page.cursor : null }
  },
  async image(id, token) {
    const { get } = await import('@vercel/blob')
    const blob = await get(`photodump/images/${id}.jpg`, { access: 'private', token })
    return blob ? Buffer.from(await new Response(blob.stream).arrayBuffer()) : null
  },
  async save(id, image, record, token) {
    const { put } = await import('@vercel/blob')
    const options = { access: 'private', token, addRandomSuffix: false, allowOverwrite: true }
    await put(`photodump/images/${id}.jpg`, image, { ...options, contentType: 'image/jpeg' })
    await put(`photodump/records/${id}.json`, JSON.stringify(record), { ...options, contentType: 'application/json' })
  },
  async remove(id, token) {
    const { del } = await import('@vercel/blob')
    await del([`photodump/records/${id}.json`, `photodump/images/${id}.jpg`], { token })
  },
}

export function createPhotodumpHandler({ env = process.env, store = storage,
  sanitize = image => sharp(image, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(),
} = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    const send = (status, body) => res.status(status).json(body)
    if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, DELETE')
      return send(405, { error: 'Method not allowed' })
    }
    if (!env.BLOB_READ_WRITE_TOKEN) return send(503, { error: 'Photodump unavailable' })
    if (req.method !== 'GET') {
      if (typeof env.PHOTODUMP_UPDATE_TOKEN !== 'string' || env.PHOTODUMP_UPDATE_TOKEN.length < 32) return send(503, { error: 'Photodump updates unavailable' })
      if (!authorize(req.headers.authorization, env.PHOTODUMP_UPDATE_TOKEN)) return send(401, { error: 'Unauthorized' })
    }
    try {
      const query = new URL(req.url || '/api/photodump', 'https://localhost').searchParams
      if (req.method === 'GET') {
        if (query.has('image')) {
          const id = query.get('image')
          if (!ID.test(id)) throw new RequestError(400, 'Invalid photo ID')
          const image = await store.image(id, env.BLOB_READ_WRITE_TOKEN)
          if (!image) return send(404, { error: 'Photo not found' })
          res.setHeader('Content-Type', 'image/jpeg')
          res.setHeader('Content-Length', image.length)
          return res.status(200).end(image)
        }
        const cursor = query.get('cursor') || undefined
        if (cursor && (cursor.length > 2048 || /[\r\n\0]/.test(cursor))) throw new RequestError(400, 'Invalid cursor')
        const page = await store.list(cursor, env.BLOB_READ_WRITE_TOKEN)
        return send(200, { photos: page.photos.map(publicPhoto).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)), cursor: page.cursor })
      }
      if (req.method === 'DELETE') {
        const id = query.get('id')
        if (!ID.test(id || '')) throw new RequestError(400, 'Invalid photo ID')
        await store.remove(id, env.BLOB_READ_WRITE_TOKEN)
        return send(200, { deleted: id })
      }
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(req.headers['content-type'] || '')) throw new RequestError(415, 'Use application/json')
      const { image, metadata } = parsePhoto(await bodyJSON(req))
      let clean
      try { clean = await sanitize(image) } catch { throw new RequestError(400, 'Invalid JPEG image') }
      const id = createHash('sha256').update(clean).update(JSON.stringify(metadata)).digest('hex')
      const record = { id, ...metadata }
      await store.save(id, clean, record, env.BLOB_READ_WRITE_TOKEN)
      return send(200, publicPhoto(record))
    } catch (error) {
      if (error instanceof RequestError) return send(error.status, { error: error.message })
      return send(503, { error: 'Photodump request failed' })
    }
  }
}

export default createPhotodumpHandler()
