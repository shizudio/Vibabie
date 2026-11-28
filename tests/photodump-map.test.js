import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../photodump.js', import.meta.url), 'utf8')
const css = readFileSync(new URL('../photodump.css', import.meta.url), 'utf8')

test('photodump uses Esri World Light Gray Canvas and stops before the empty zoom levels', () => {
  assert.doesNotMatch(source, /tile\.openstreetmap\.org/)
  assert.doesNotMatch(source, /cartocdn|api[_-]?key|access_token/i)
  assert.match(source, /World_Light_Gray_Base\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}/)
  assert.match(source, /World_Light_Gray_Reference\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}/)
  assert.match(source, /maxZoom: 16/)
  assert.doesNotMatch(source, /maxZoom: 1[89]/)
  assert.match(source, /attributionControl\.setPrefix\(''\)/)
  assert.match(source, /Esri, HERE, Garmin, &copy; <a href="https:\/\/www\.openstreetmap\.org\/copyright">OpenStreetMap<\/a> contributors, and the GIS user community/)
  assert.match(source, /tileerror[\s\S]*pd-tile-error/)
  assert.match(source, /touchZoom: false/)
  assert.match(source, /dragging: true/)
  assert.match(source, /!base\.isLoading\(\) && !labels\.isLoading\(\)/)
  assert.doesNotMatch(source, /\btiles\.isLoading/)
  // The old street-map wash would fade this basemap's type.
  assert.doesNotMatch(css, /leaflet-tile-pane\s*\{[^}]*filter:/)
})
