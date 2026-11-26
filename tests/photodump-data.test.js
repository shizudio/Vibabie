import test from 'node:test'
import assert from 'node:assert/strict'
import { loadPhotos, normalizePhoto } from '../photodump-data.js'

const photo = (id, date, extra = {}) => ({ id: id.repeat(64), capturedAt: date, ...extra })
test('public records use a same-origin image URL and exclude malformed locations', () => {
  const clean = normalizePhoto(photo('a', '2026-11-26T09:00:00Z', { imageUrl: 'https://untrusted.invalid/secret', latitude: 300, longitude: 0, secret: 'private' }))
  assert.deepEqual(clean, { id: 'a'.repeat(64), capturedAt: '2026-11-26T09:00:00.000Z', imageUrl: `/api/photodump?image=${'a'.repeat(64)}` })
  assert.equal(normalizePhoto({ id: '<script>', capturedAt: '2026-11-26' }), null)
  assert.equal(normalizePhoto(photo('a', 'invalid')), null)
  assert.equal(normalizePhoto(photo('b', '2026-11-25', { latitude: 0, longitude: 0 })).latitude, 0)
})
test('pagination follows encoded cursors, deduplicates and globally sorts dates', async () => {
  const urls = []
  const pages = [
    { photos: [photo('a', '2026-01-01'), { id: 'invalid' }], cursor: 'next/+' },
    { photos: [photo('b', '2026-11-26'), photo('a', '2026-01-01')], cursor: null },
  ]
  const result = await loadPhotos({ fetcher: async url => { urls.push(url); return { ok: true, json: async () => pages.shift() } } })
  assert.deepEqual(urls, ['/api/photodump', '/api/photodump?cursor=next%2F%2B'])
  assert.deepEqual(result.map(p => p.id), ['b'.repeat(64), 'a'.repeat(64)])
})
test('repeating pagination, unexpected responses and HTTP errors fail visibly', async () => {
  await assert.rejects(loadPhotos({ fetcher: async () => ({ ok: true, json: async () => ({ photos: [], cursor: 'loop' }) }) }), /finish loading/)
  await assert.rejects(loadPhotos({ fetcher: async () => ({ ok: true, json: async () => '<html>' }) }), /unexpected response/)
  await assert.rejects(loadPhotos({ fetcher: async () => ({ ok: false }) }), /could not be loaded/)
})
