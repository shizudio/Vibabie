import test from 'node:test'
import assert from 'node:assert/strict'
import { cityFromGeocode, photosInCity } from '../photodump-city.js'

test('districts in one city share a gallery and another city stays out', () => {
  const haidian = cityFromGeocode({ city: 'Beijing', locality: 'Haidian', countryCode: 'cn' })
  const changping = cityFromGeocode({ city: 'Beijing', locality: 'Changping', countryCode: 'CN' })
  const mentougou = cityFromGeocode({ city: ' Beijing ', locality: 'Mentougou', countryCode: 'CN' })
  assert.equal(haidian.name, 'Beijing')
  assert.equal(haidian.key, changping.key)
  assert.equal(haidian.key, mentougou.key)

  const photos = [
    { id: 'haidian', cityKey: haidian.key, latitude: 39.98, longitude: 116.31 },
    { id: 'changping', cityKey: changping.key, latitude: 40.32, longitude: 116.32 },
    { id: 'mentougou', cityKey: mentougou.key, latitude: 39.9, longitude: 116.02 },
    { id: 'shanghai', cityKey: cityFromGeocode({ city: 'Shanghai', locality: 'Huangpu', countryCode: 'CN' }).key },
    { id: 'paris-fr', cityKey: cityFromGeocode({ city: 'Paris', locality: 'Quartier des Archives', countryCode: 'FR' }).key },
    { id: 'paris-us', cityKey: cityFromGeocode({ city: 'Paris', countryCode: 'US' }).key },
    { id: 'unlocated' },
  ]
  assert.deepEqual(photosInCity(photos, photos[0]).map(photo => photo.id), ['haidian', 'changping', 'mentougou'])
  assert.deepEqual(photosInCity(photos, photos[3]).map(photo => photo.id), ['shanghai'])
  assert.deepEqual(photosInCity(photos, photos[4]).map(photo => photo.id), ['paris-fr'])
  assert.deepEqual(photosInCity(photos, photos[5]).map(photo => photo.id), ['paris-us'])
  assert.deepEqual(photosInCity(photos, photos[6]).map(photo => photo.id), ['unlocated'])
})

test('a missing city does not fall back to a district or merge with other unknown photographs', () => {
  assert.deepEqual(cityFromGeocode({ city: '', locality: 'Haidian', countryCode: 'CN' }), { key: '', name: '' })
  assert.deepEqual(cityFromGeocode({ city: 'Beijing', locality: 'Haidian' }), { key: '', name: '' })
  assert.deepEqual(cityFromGeocode(null), { key: '', name: '' })
  const unknown = [{ id: 'a' }, { id: 'b' }]
  assert.deepEqual(photosInCity(unknown, unknown[0]).map(photo => photo.id), ['a'])
})
