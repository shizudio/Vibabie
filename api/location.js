import { createHash, timingSafeEqual } from 'node:crypto'
import countries from 'i18n-iso-countries'

const PATHNAME = 'location/current.json'
const FALLBACK_CITY = 'Beijing'
const MAX_BODY_BYTES = 1024
const CITY_PATTERN = /^[\p{L}\p{M}\p{N} ,.’'()\-]+$/u
const COUNTRY_CODES = countries.getAlpha2Codes()
const MAINLAND_CHINA_NAMES = new Set([
  '中国大陆', '中國大陸', '中国内地', '中國內地',
  '中华人民共和国', '中華人民共和國', 'mainland china', 'china mainland',
])
const LOCALIZED_COUNTRY_CODES = new Map([
  ['台灣', 'TW'], ['臺灣', 'TW'], ['香港特别行政区', 'HK'], ['香港特別行政區', 'HK'],
  ['澳门特别行政区', 'MO'], ['澳門特別行政區', 'MO'],
])
// The package's Chinese locale is Simplified; iPhones can supply Traditional.
for (const locale of ['zh-Hant', 'zh-Hans']) {
  const displayNames = new Intl.DisplayNames([locale], { type: 'region' })
  for (const code of Object.keys(COUNTRY_CODES)) {
    LOCALIZED_COUNTRY_CODES.set(displayNames.of(code).normalize('NFC').toLowerCase(), code)
  }
}

class RequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function validCity(value) {
  if (typeof value !== 'string' || /\p{C}/u.test(value)) return null
  const city = value.trim().normalize('NFC')
  return city.length > 0 && city.length <= 80 && /\p{L}/u.test(city) && CITY_PATTERN.test(city) ? city : null
}

function validCountryCode(value) {
  if (typeof value !== 'string' || /\p{C}/u.test(value)) return null
  const code = value.trim().toUpperCase()
  return Object.hasOwn(COUNTRY_CODES, code) ? code : null
}

function countryCodeForName(value) {
  if (typeof value !== 'string' || value.length > 100 || /\p{C}/u.test(value)) return null
  const name = value.trim().normalize('NFC')
  if (MAINLAND_CHINA_NAMES.has(name.toLowerCase())) return 'CN'
  const localized = LOCALIZED_COUNTRY_CODES.get(name.toLowerCase())
  if (localized) return localized
  for (const language of countries.getSupportedLanguages()) {
    const code = countries.getAlpha2Code(name, language)
    if (code && validCountryCode(code)) return code
  }
  return null
}

const cityIdentity = city => city.normalize('NFC').toLowerCase()

function savedLocation(value) {
  const city = validCity(value?.city)
  if (!city) return null
  // Only this known legacy fallback can acquire a country without phone data.
  const countryCode = validCountryCode(value.countryCode) ||
    (['beijing', '北京', '北京市'].includes(cityIdentity(city)) ? 'CN' : null)
  return countryCode ? { city, countryCode } : { city }
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
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.hasOwn(body, 'city') ||
      Object.keys(body).some(key => !['city', 'countryCode', 'country'].includes(key)) ||
      (Object.hasOwn(body, 'countryCode') && Object.hasOwn(body, 'country'))) {
    throw new RequestError(400, 'Send a city and optionally one country field')
  }
  const city = validCity(body.city)
  if (!city) throw new RequestError(400, 'Invalid city')
  if (Object.hasOwn(body, 'countryCode') || Object.hasOwn(body, 'country')) {
    const countryCode = Object.hasOwn(body, 'countryCode')
      ? validCountryCode(body.countryCode) : countryCodeForName(body.country)
    if (!countryCode) throw new RequestError(400, 'Invalid country')
    return { city, countryCode }
  }
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
      if (!env.BLOB_READ_WRITE_TOKEN) return send(200, { city: FALLBACK_CITY, countryCode: 'CN' })
      try {
        const value = await store.read(env.BLOB_READ_WRITE_TOKEN)
        const location = savedLocation(value === null ? { city: FALLBACK_CITY } : value)
        if (!location) return send(503, { error: 'Location unavailable' })
        return send(200, location)
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
      if (!value.countryCode) {
        const previous = savedLocation(await store.read(env.BLOB_READ_WRITE_TOKEN))
        if (previous?.countryCode && cityIdentity(previous.city) === cityIdentity(value.city)) {
          value.countryCode = previous.countryCode
        }
      }
      await store.write(value, env.BLOB_READ_WRITE_TOKEN)
      return send(200, value)
    } catch (error) {
      if (error instanceof RequestError) return send(error.status, { error: error.message })
      return send(503, { error: 'Location update failed' })
    }
  }
}

export default createLocationHandler()
