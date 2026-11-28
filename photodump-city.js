// City is the only gallery boundary. A district, neighborhood, or map cluster is not a separate set.
export function cityFromGeocode(value) {
  const name = value && typeof value.city === 'string' ? value.city.trim() : ''
  const country = value && typeof value.countryCode === 'string' ? value.countryCode.trim().toUpperCase() : ''
  if (!name || !/^[A-Z]{2}$/.test(country)) return { key: '', name: '' }
  return { key: `${country}\n${name.toLocaleLowerCase('en')}`, name }
}

export function photosInCity(photos, photo) {
  if (!photo?.cityKey) return photo ? [photo] : []
  const same = photos.filter(item => item?.cityKey === photo.cityKey)
  if (!same.some(item => item.id === photo.id)) same.push(photo)
  return same
}
