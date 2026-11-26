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
    assert.deepEqual(res.body, { city: 'Beijing', countryCode: 'CN' })
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
  for (const city of ['<img src=x onerror=alert(1)>', '40.7128,-74.0060', 'Paris\nLondon', 'Paris\n', '', '  ', 'A'.repeat(81), 42]) {
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

test('country codes are case-insensitive, validated ISO alpha-2, and stored canonically', async () => {
  let saved
  const res = await request({ body: { city: 'Paris', countryCode: ' fr ' }, write: async value => { saved = value } })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(saved, { city: 'Paris', countryCode: 'FR' })
  assert.deepEqual(res.body, saved)
  for (const countryCode of ['ZZ', 'EU', 'UN', 'FRA', '250', '🇫🇷', '', null, 42, '<FR>']) {
    const invalid = await request({ body: { city: 'Paris', countryCode }, write: () => assert.fail('invalid country stored') })
    assert.equal(invalid.statusCode, 400)
  }
})

test('country names normalize English, Chinese, and other supported phone locales', async () => {
  for (const [country, countryCode] of [
    ['China', 'CN'], ['  china  ', 'CN'], ['中国', 'CN'], ['中华人民共和国', 'CN'],
    ['中国大陆', 'CN'], ['中國大陸', 'CN'], ['Mainland China', 'CN'],
    ['United States', 'US'], ['美国', 'US'], ['United Kingdom', 'GB'], ['英国', 'GB'],
    ['Germany', 'DE'], ['Deutschland', 'DE'], ['日本', 'JP'], ['France', 'FR'],
    ['美國', 'US'], ['英國', 'GB'], ['法國', 'FR'], ['德國', 'DE'], ['中國', 'CN'],
    ['臺灣', 'TW'], ['台灣', 'TW'], ['香港特別行政區', 'HK'], ['澳門特別行政區', 'MO'],
  ]) {
    const res = await request({ body: { city: 'City', country } })
    assert.equal(res.statusCode, 200, country)
    assert.deepEqual(res.body, { city: 'City', countryCode }, country)
  }
})

test('country data cannot add coordinates, replace a city, or bypass validation', async () => {
  const bodies = [
    { country: 'China' }, { countryCode: 'CN' }, { city: 'Beijing', country: 'China', countryCode: 'CN' },
    { city: 'Beijing', countryCode: 'CN', longitude: 116 }, { city: 'Paris', country: 'Atlantis' },
    { city: 'Paris', country: '🇫🇷' }, { city: 'Paris', country: '<script>France</script>' },
    { city: 'Paris', country: null }, { city: 'Paris', country: 'A'.repeat(101) },
    { city: 'Paris', country: 'France\n' }, { city: 'Paris', countryCode: 'FR\n' },
  ]
  for (const body of bodies) {
    const res = await request({ body, write: () => assert.fail('invalid payload stored') })
    assert.equal(res.statusCode, 400)
  }
})

test('public GET returns canonical country code without exposing stored extras', async () => {
  const res = await request({ method: 'GET', read: async () => ({ city: 'Paris', countryCode: 'fr', ignored: 'private' }) })
  assert.deepEqual(res.body, { city: 'Paris', countryCode: 'FR' })
})

test('legacy Beijing records get the known China fallback without guessing other cities', async () => {
  for (const city of ['Beijing', 'beijing', '北京', '北京市']) {
    const res = await request({ method: 'GET', read: async () => ({ city }) })
    assert.deepEqual(res.body, { city, countryCode: 'CN' })
  }
  const res = await request({ method: 'GET', read: async () => ({ city: 'Paris', countryCode: 'ZZ' }) })
  assert.deepEqual(res.body, { city: 'Paris' })
})

test('old city-only shortcuts preserve a known country only for the same normalized city', async () => {
  const res = await request({ body: { city: '  PARIS  ' }, read: async () => ({ city: 'Paris', countryCode: 'FR' }) })
  assert.deepEqual(res.body, { city: 'PARIS', countryCode: 'FR' })
  const changed = await request({ body: { city: 'London' }, read: async () => ({ city: 'Paris', countryCode: 'FR' }) })
  assert.deepEqual(changed.body, { city: 'London' })
  const legacy = await request({ body: { city: '北京' }, read: async () => ({ city: '北京' }) })
  assert.deepEqual(legacy.body, { city: '北京', countryCode: 'CN' })
})

test('an explicit country replaces the previous country without reading it', async () => {
  const res = await request({ body: { city: 'London', country: 'United Kingdom' }, read: () => assert.fail('unnecessary read') })
  assert.deepEqual(res.body, { city: 'London', countryCode: 'GB' })
})

test('legacy POST storage read failure cannot overwrite a saved country', async () => {
  const res = await request({ read: async () => { throw Error('storage secret') }, write: () => assert.fail('unexpected overwrite') })
  assert.equal(res.statusCode, 503)
  assert.deepEqual(res.body, { error: 'Location update failed' })
})
