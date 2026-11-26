// Public photo records only. Upload credentials never enter this module.
export function normalizePhoto(value) {
  if (!value || !/^[a-f0-9]{64}$/.test(value.id) || typeof value.capturedAt !== 'string' || !Number.isFinite(Date.parse(value.capturedAt))) return null
  const photo = { id: value.id, capturedAt: new Date(value.capturedAt).toISOString(), imageUrl: `/api/photodump?image=${value.id}` }
  if (Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180) {
    photo.latitude = value.latitude
    photo.longitude = value.longitude
  }
  return photo
}

export async function loadPhotos({ fetcher = fetch, signal } = {}) {
  const photos = new Map()
  const seen = new Set()
  let cursor = null
  do {
    const url = `/api/photodump${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
    const response = await fetcher(url, { signal, cache: 'no-store', headers: { Accept: 'application/json' } })
    if (!response.ok) throw Error('The photo collection could not be loaded.')
    const page = await response.json()
    if (!page || !Array.isArray(page.photos) || !(page.cursor === null || typeof page.cursor === 'string')) throw Error('The photo collection returned an unexpected response.')
    for (const value of page.photos) {
      const photo = normalizePhoto(value)
      if (photo) photos.set(photo.id, photo)
    }
    cursor = page.cursor || null
    if (cursor) {
      if (seen.has(cursor) || seen.size >= 1000) throw Error('The photo collection could not finish loading.')
      seen.add(cursor)
    }
  } while (cursor)
  return [...photos.values()].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt) || a.id.localeCompare(b.id))
}
