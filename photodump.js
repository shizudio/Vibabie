import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { loadPhotos } from './photodump-data.js'

// Markercluster 1.x attaches to the shared Leaflet global.
window.L = L
await import('leaflet.markercluster')

const $ = id => document.getElementById(id)
const dateLong = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
const dateShort = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const monthLong = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'long', timeZone: 'UTC' })
const state = { photos: [], view: 'map', controller: null, selected: [], dialogPhotos: [], dialogIndex: 0, dialogTrigger: null, loaded: false }
const coarsePointer = matchMedia('(pointer: coarse)').matches
const map = L.map('pd-map', {
  center: [22, 15], zoom: 2, minZoom: 2, maxZoom: 18,
  zoomControl: false, scrollWheelZoom: false, touchZoom: false, boxZoom: false,
  doubleClickZoom: false, keyboard: false, dragging: !coarsePointer, tapHold: false,
  zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false,
  attributionControl: true,
})
map.attributionControl.setPrefix('')
const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19, updateWhenIdle: true, keepBuffer: 1,
}).addTo(map)
tiles.on('tileerror', () => { $('pd-tile-error').hidden = false })
tiles.on('tileload', () => { $('pd-tile-error').hidden = true })

function pin(photo, count = 1) {
  const frame = document.createElement('span')
  frame.className = `pd-pin${count > 1 ? ' pd-pin-stack' : ''}`
  const image = document.createElement('img')
  image.src = photo.imageUrl
  image.alt = ''
  image.loading = 'lazy'
  frame.append(image)
  if (count > 1) {
    const badge = document.createElement('span')
    badge.className = 'pd-pin-count'
    badge.textContent = count
    frame.append(badge)
  }
  return L.divIcon({ html: frame, className: 'pd-photo-marker', iconSize: [64, 72], iconAnchor: [32, 78] })
}

const clusters = L.markerClusterGroup({
  maxClusterRadius: 64, showCoverageOnHover: false, zoomToBoundsOnClick: false,
  spiderfyOnMaxZoom: false, animate: false, animateAddingMarkers: false,
  iconCreateFunction(cluster) {
    const children = cluster.getAllChildMarkers().sort((a, b) => b.photo.capturedAt.localeCompare(a.photo.capturedAt))
    return pin(children[0].photo, children.length)
  },
}).addTo(map)
clusters.on('clusterclick', event => {
  const photos = event.layer.getAllChildMarkers().map(marker => marker.photo)
  selectPlace(photos)
})
clusters.on('clustermouseover', event => {
  const element = event.layer.getElement()
  element?.setAttribute('aria-label', `Explore ${event.layer.getChildCount()} photographs from this area`)
})
clusters.on('animationend', labelClusters)
map.on('zoomend moveend layeradd', labelClusters)

function labelClusters() {
  // Cluster icon DOM is managed by Leaflet; give every generated control a useful name.
  map.eachLayer(layer => {
    if (typeof layer.getChildCount !== 'function') return
    const element = layer.getElement?.()
    if (!element) return
    element.setAttribute('aria-label', `Explore ${layer.getChildCount()} photographs from this area`)
    element.setAttribute('role', 'button')
    element.setAttribute('tabindex', '0')
  })
}

function setView(view) {
  state.view = view
  $('pd-map-view').hidden = view !== 'map'
  $('pd-grid-view').hidden = view !== 'grid'
  $('pd-map-button').setAttribute('aria-pressed', String(view === 'map'))
  $('pd-grid-button').setAttribute('aria-pressed', String(view === 'grid'))
  if (view === 'map') map.invalidateSize({ animate: false })
}

function fitPhotos() {
  const located = state.photos.filter(photo => 'latitude' in photo)
  if (located.length) map.fitBounds(L.latLngBounds(located.map(photo => [photo.latitude, photo.longitude])), { padding: [72, 72], maxZoom: 12, animate: false })
  else map.setView([22, 15], 2, { animate: false })
}

function photoButton(photo, collection) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'pd-photo-button'
  const date = dateLong.format(new Date(photo.capturedAt))
  button.setAttribute('aria-label', `Open photograph taken ${date}${'latitude' in photo ? '' : ', no recorded location'}`)
  const image = document.createElement('img')
  image.src = photo.imageUrl
  image.alt = `Photograph taken ${date}`
  image.loading = 'lazy'
  image.decoding = 'async'
  const caption = document.createElement('span')
  caption.className = 'pd-photo-date'
  caption.textContent = `${dateShort.format(new Date(photo.capturedAt))}${'latitude' in photo ? '' : ' · No location'}`
  button.append(image, caption)
  button.addEventListener('click', () => openPhoto(photo, collection, button))
  return button
}

function selectPlace(photos) {
  state.selected = [...photos].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
  $('pd-place').hidden = false
  $('pd-place-title').textContent = `${photos.length} photograph${photos.length === 1 ? '' : 's'}`
  const strip = $('pd-filmstrip')
  strip.replaceChildren(...state.selected.map(photo => photoButton(photo, state.selected)))
  $('pd-map-hint').textContent = `${photos.length} photograph${photos.length === 1 ? '' : 's'} selected. Browse them below.`
  strip.querySelector('button')?.focus({ preventScroll: true })
}

function clearPlace() {
  state.selected = []
  $('pd-place').hidden = true
  $('pd-filmstrip').replaceChildren()
  $('pd-map-hint').textContent = 'Choose a photograph on the map to explore a place.'
}

function renderGrid() {
  const grid = $('pd-grid-view')
  grid.replaceChildren()
  if (!state.photos.length) {
    const empty = document.createElement('div')
    empty.className = 'pd-grid-empty'
    const heading = document.createElement('h2')
    heading.textContent = 'The first photograph is still to come.'
    const copy = document.createElement('p')
    copy.textContent = 'Once the album is synced, its photographs will appear here.'
    empty.append(heading, copy)
    grid.append(empty)
    return
  }
  const groups = new Map()
  for (const photo of state.photos) {
    const key = photo.capturedAt.slice(0, 7)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(photo)
  }
  for (const photos of groups.values()) {
    const section = document.createElement('section')
    section.className = 'pd-date-group'
    const heading = document.createElement('h2')
    heading.className = 'pd-date-heading'
    heading.textContent = monthLong.format(new Date(photos[0].capturedAt))
    const items = document.createElement('div')
    items.className = 'pd-photo-grid'
    items.append(...photos.map(photo => photoButton(photo, state.photos)))
    section.append(heading, items)
    grid.append(section)
  }
}

function renderPhotos() {
  clusters.clearLayers()
  clearPlace()
  const located = state.photos.filter(photo => 'latitude' in photo)
  for (const photo of located) {
    const marker = L.marker([photo.latitude, photo.longitude], {
      icon: pin(photo), title: `Explore photograph from ${dateLong.format(new Date(photo.capturedAt))}`,
      alt: `Explore photograph from ${dateLong.format(new Date(photo.capturedAt))}`, keyboard: true, autoPanOnFocus: false,
    })
    marker.photo = photo
    marker.on('click', () => selectPlace([photo]))
    clusters.addLayer(marker)
  }
  const total = state.photos.length
  const unlocated = total - located.length
  $('pd-count').textContent = `${total} photograph${total === 1 ? '' : 's'}${unlocated ? ` · ${unlocated} without a location` : ''}`
  $('pd-map-empty').hidden = located.length > 0
  if (total && !located.length) {
    $('pd-map-empty').querySelector('h2').textContent = 'These moments have no map pins.'
    $('pd-map-empty').querySelector('p').textContent = 'Their locations weren’t recorded. Find every photograph in Grid.'
  } else {
    $('pd-map-empty').querySelector('h2').textContent = 'A little room for everywhere.'
    $('pd-map-empty').querySelector('p').textContent = 'Your photographs will find their places here.'
  }
  renderGrid()
  fitPhotos()
  labelClusters()
}

async function refresh() {
  state.controller?.abort()
  const controller = new AbortController()
  state.controller = controller
  const timeout = setTimeout(() => controller.abort(), 30_000)
  $('pd-refresh').disabled = true
  $('pd-refresh').textContent = 'Refreshing…'
  $('photodump').setAttribute('aria-busy', 'true')
  $('pd-message').hidden = true
  try {
    const photos = await loadPhotos({ signal: controller.signal })
    if (state.controller !== controller) return
    state.photos = photos
    state.loaded = true
    renderPhotos()
    $('pd-last-updated').textContent = `Updated ${new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date())}`
  } catch (error) {
    if (state.controller !== controller) return
    $('pd-message').hidden = false
    $('pd-retry').hidden = false
    $('pd-message-text').textContent = state.loaded ? 'The collection couldn’t refresh. Your last view is still here.' : 'The photographs couldn’t load. Please try again.'
    if (!state.loaded) {
      $('pd-count').textContent = 'Photographs unavailable'
      $('pd-map-empty').hidden = false
      $('pd-map-empty').querySelector('h2').textContent = 'The journal will be back shortly.'
      $('pd-map-empty').querySelector('p').textContent = 'Try refreshing the photographs.'
    }
  } finally {
    clearTimeout(timeout)
    if (state.controller === controller) {
      $('pd-refresh').disabled = false
      $('pd-refresh').textContent = 'Refresh'
      $('photodump').removeAttribute('aria-busy')
    }
  }
}

const dialog = $('pd-dialog')
function openPhoto(photo, collection, trigger) {
  state.dialogPhotos = collection
  state.dialogIndex = collection.findIndex(item => item.id === photo.id)
  state.dialogTrigger = trigger
  renderDialog()
  dialog.showModal()
}
function renderDialog() {
  const photo = state.dialogPhotos[state.dialogIndex]
  $('pd-dialog-image').hidden = false
  $('pd-image-error').hidden = true
  $('pd-dialog-image').src = photo.imageUrl
  $('pd-dialog-image').alt = `Photograph taken ${dateLong.format(new Date(photo.capturedAt))}`
  $('pd-dialog-caption').textContent = `${dateLong.format(new Date(photo.capturedAt))}${'latitude' in photo ? ' · Approximate location recorded' : ' · No recorded location'}`
  $('pd-dialog-count').textContent = `${state.dialogIndex + 1} / ${state.dialogPhotos.length}`
  $('pd-previous').disabled = state.dialogIndex === 0
  $('pd-next').disabled = state.dialogIndex === state.dialogPhotos.length - 1
}
function stepPhoto(direction) {
  const index = state.dialogIndex + direction
  if (index < 0 || index >= state.dialogPhotos.length) return
  state.dialogIndex = index
  renderDialog()
}
dialog.addEventListener('close', () => {
  $('pd-dialog-image').removeAttribute('src')
  state.dialogTrigger?.isConnected && state.dialogTrigger.focus({ preventScroll: true })
})
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close() })
dialog.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') stepPhoto(-1)
  if (event.key === 'ArrowRight') stepPhoto(1)
  // Native showModal traps focus; explicitly cycle controls for consistent Safari behavior.
  if (event.key === 'Tab') {
    const controls = [...dialog.querySelectorAll('button:not(:disabled)')]
    const first = controls[0], last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
})
$('pd-dialog-image').addEventListener('error', () => { $('pd-dialog-image').hidden = true; $('pd-image-error').hidden = false })
$('pd-dialog-close').addEventListener('click', () => dialog.close())
$('pd-previous').addEventListener('click', () => stepPhoto(-1))
$('pd-next').addEventListener('click', () => stepPhoto(1))
$('pd-map-button').addEventListener('click', () => setView('map'))
$('pd-grid-button').addEventListener('click', () => setView('grid'))
$('pd-refresh').addEventListener('click', refresh)
$('pd-retry').addEventListener('click', refresh)
$('pd-fit').addEventListener('click', fitPhotos)
$('pd-zoom-in').addEventListener('click', () => map.zoomIn(1, { animate: false }))
$('pd-zoom-out').addEventListener('click', () => map.zoomOut(1, { animate: false }))
$('pd-clear-place').addEventListener('click', () => { clearPlace(); $('pd-fit').focus({ preventScroll: true }) })
await refresh()
