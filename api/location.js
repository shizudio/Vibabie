import { createHash, timingSafeEqual } from 'node:crypto'

const PATHNAME = 'location/current.json'
const FALLBACK_CITY = 'Beijing'
const MAX_BODY_BYTES = 1024
const CITY_PATTERN = /^[\p{L}\p{M}\p{N} ,.’'()\-]+$/u

class RequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function validCity(value) {
  if (typeof value !== 'string') return null
  const city = value.trim().normalize('NFC')
  return city.length > 0 && city.length <= 80 && /\p{L}/u.test(city) && CITY_PATTERN.test(city) ? city : null
}

function authorized(header, token) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false
  // Hash first so comparison time does not reveal a shared secret's length.
  const hash = value => createHash('sha256').update(value).digest()
  return timingSafeEqual(hash(header.slice(7)), hash(token))
}

async function readBody(req) {
  const declaredLength = req.headers['content-length']
  if (declaredLength && Number(declaredLength) > MAX_BODY_BYTES) {
    throw new RequestError(413, 'Request too large')
  }
  let body = req.body
  if (body === undefined) {
    const chunks = []
    let length = 0
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      length += buffer.length
      if (length > MAX_BODY_BYTES) throw new RequestError(413, 'Request too large')
      chunks.push(buffer)
    }
    body = Buffer.concat(chunks)
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8')
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new RequestError(413, 'Request too large')
    try { body = JSON.parse(body) } catch { throw new RequestError(400, 'Invalid JSON') }
  } else if (body && Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) {
    throw new RequestError(413, 'Request too large')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !Object.hasOwn(body, 'city')) {
    throw new RequestError(400, 'Send only a city')
  }
  const city = validCity(body.city)
  if (!city) throw new RequestError(400, 'Invalid city')
  return { city }
}

const blobStore = {
  async read(token) {
    const { get } = await import('@vercel/blob')
    const blob = await get(PATHNAME, { access: 'private', token, useCache: false })
    if (!blob) return null
    return new Response(blob.stream).json()
  },
  async write(value, token) {
    const { put } = await import('@vercel/blob')
    await put(PATHNAME, JSON.stringify(value), {
      access: 'private', token, addRandomSuffix: false, allowOverwrite: true,
      contentType: 'application/json',
    })
  },
}

// Dependencies are replaceable for security and storage-failure tests.
export function createLocationHandler({ env = process.env, store = blobStore } = {}) {
  return async function location(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    const send = (status, value) => res.status(status).json(value)

    if (req.method === 'GET') {
      if (!env.BLOB_READ_WRITE_TOKEN) return send(200, { city: FALLBACK_CITY })
      try {
        const value = await store.read(env.BLOB_READ_WRITE_TOKEN)
        const city = value === null ? FALLBACK_CITY : validCity(value?.city)
        if (!city) return send(503, { error: 'Location unavailable' })
        return send(200, { city })
      } catch {
        return send(503, { error: 'Location unavailable' })
      }
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST')
      return send(405, { error: 'Method not allowed' })
    }

    const token = env.LOCATION_UPDATE_TOKEN
    if (typeof token !== 'string' || token.length < 32 || !env.BLOB_READ_WRITE_TOKEN) {
      return send(503, { error: 'Location updates unavailable' })
    }
    if (!authorized(req.headers.authorization, token)) return send(401, { error: 'Unauthorized' })
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(req.headers['content-type'] || '')) {
      return send(415, { error: 'Use application/json' })
    }

    try {
      const value = await readBody(req)
      await store.write(value, env.BLOB_READ_WRITE_TOKEN)
      return send(200, value)
    } catch (error) {
      if (error instanceof RequestError) return send(error.status, { error: error.message })
      return send(503, { error: 'Location update failed' })
    }
  }
}

export default createLocationHandler()
