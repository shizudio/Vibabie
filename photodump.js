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
/* ANIMATION STORYBOARD — first visit only; refresh and zoom never replay it.
 *  ready   data settled + first map tiles ready (2400ms safety fallback)
 *    0ms   paper veil begins its 1200ms dissolve
 *  180ms   framed photo pins emerge
 *  320ms   map controls finish their quieter entrance
 */
const ENTRY = { fallback: 2400 }
const entry = { dataReady: false, tilesReady: false, revealed: false }
function revealMap(force = false) {
  if (entry.revealed || (!force && !(entry.dataReady && entry.tilesReady))) return
  entry.revealed = true
  clearTimeout(entryFallback)
  document.body.classList.add('pd-entered')
}
const entryFallback = setTimeout(() => revealMap(true), ENTRY.fallback)
const state = { photos: [], view: 'map', controller: null, dialogPhotos: [], dialogIndex: 0, dialogTrigger: null, dialogMode: 'photo', dialogTitle: '', loaded: false }
const coarsePointer = matchMedia('(pointer: coarse)').matches
const desktopPins = matchMedia('(min-width: 1024px)')
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
tiles.on('load', () => { entry.tilesReady = true; revealMap() })
tiles.on('tileerror', () => { $('pd-tile-error').hidden = false })
tiles.on('tileload', () => { $('pd-tile-error').hidden = true })

function pin(photo, count = 1) {
  const imageSize = desktopPins.matches ? 128 : 64
  const frameSize = imageSize + 8 // 3px mat + 1px border on each side
  const frame = document.createElement('span')
  frame.className = `pd-pin${count > 1 ? ' pd-pin-stack' : ''}`
  const image = document.createElement('img')
  image.src = photo.imageUrl
  image.alt = ''
  image.width = imageSize
  image.height = imageSize
  image.loading = 'lazy'
  frame.append(image)
  if (count > 1) {
    const countLabel = document.createElement('span')
    countLabel.className = 'pd-pin-count'
    countLabel.textContent = count
    frame.append(countLabel)
  }
  return L.divIcon({ html: frame, className: 'pd-photo-marker', iconSize: [frameSize, frameSize], iconAnchor: [frameSize / 2, frameSize + 12] })
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
  const photos = event.layer.getAllChildMarkers().map(marker => marker.photo).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
  openPhoto(photos[0], photos, event.layer.getElement())
})
clusters.on('clustermouseover', event => {
  const element = event.layer.getElement()
  element?.setAttribute('aria-label', `Explore ${event.layer.getChildCount()} photographs from this area`)
})
clusters.on('animationend', labelClusters)
map.on('zoomend moveend layeradd', labelClusters)
// CSS changes the print size at the same breakpoint; refresh Leaflet geometry too.
desktopPins.addEventListener('change', () => {
  clusters.eachLayer(marker => { if (marker.photo) marker.setIcon(pin(marker.photo)) })
  clusters.refreshClusters()
  labelClusters()
  map.invalidateSize({ animate: false, pan: false })
  fitPhotos()
})

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
  $('pd-stack-view').hidden = view !== 'stack'
  $('pd-map-button').setAttribute('aria-pressed', String(view === 'map'))
  $('pd-stack-button').setAttribute('aria-pressed', String(view === 'stack'))
  if (view === 'map') map.invalidateSize({ animate: false })
}

function fitPhotos() {
  const located = state.photos.filter(photo => 'latitude' in photo)
  const frameSize = desktopPins.matches ? 136 : 72
  if (located.length) map.fitBounds(L.latLngBounds(located.map(photo => [photo.latitude, photo.longitude])), {
    paddingTopLeft: [frameSize / 2 + 32, frameSize + 48],
    paddingBottomRight: [frameSize / 2 + 32, 60],
    maxZoom: 12, animate: false,
  })
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

function renderStacks() {
  const stacks = $('pd-stack-view')
  stacks.replaceChildren()
  if (!state.photos.length) {
    const empty = document.createElement('p')
    empty.className = 'pd-stack-empty'
    empty.textContent = 'The first photograph is still to come.'
    stacks.append(empty)
    return
  }
  const groups = new Map()
  for (const photo of state.photos) {
    const key = photo.capturedAt.slice(0, 7)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(photo)
  }
  for (const photos of groups.values()) {
    const title = monthLong.format(new Date(photos[0].capturedAt))
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'pd-pile-button'
    button.setAttribute('aria-label', `Open ${photos.length} photographs from ${title} in a grid`)
    const pile = document.createElement('span')
    pile.className = 'pd-pile'
    const rotations = [-11, 8, -5, 4, -2]
    const offsets = [[-24, 8], [22, -9], [-9, -18], [12, 10], [0, 0]]
    photos.slice(0, 5).reverse().forEach((photo, index) => {
      const print = document.createElement('span')
      print.className = 'pd-pile-print'
      print.style.setProperty('--turn', `${rotations[index]}deg`)
      print.style.setProperty('--x', `${offsets[index][0]}px`)
      print.style.setProperty('--y', `${offsets[index][1]}px`)
      print.style.setProperty('--order', index)
      const image = document.createElement('img')
      image.src = photo.imageUrl
      image.alt = ''
      image.loading = 'lazy'
      print.append(image)
      pile.append(print)
    })
    const caption = document.createElement('span')
    caption.className = 'pd-pile-caption'
    const name = document.createElement('span')
    name.textContent = title
    const count = document.createElement('span')
    count.textContent = `${photos.length} photograph${photos.length === 1 ? '' : 's'}`
    caption.append(name, count)
    button.append(pile, caption)
    button.addEventListener('click', () => openCollection(photos, title, button))
    stacks.append(button)
  }
}

function renderPhotos() {
  clusters.clearLayers()
  const located = state.photos.filter(photo => 'latitude' in photo)
  for (const photo of located) {
    const marker = L.marker([photo.latitude, photo.longitude], {
      icon: pin(photo), title: `Explore photograph from ${dateLong.format(new Date(photo.capturedAt))}`,
      alt: `Explore photograph from ${dateLong.format(new Date(photo.capturedAt))}`, keyboard: true, autoPanOnFocus: false,
    })
    marker.photo = photo
    marker.on('click', () => openPhoto(photo, [photo], marker.getElement()))
    clusters.addLayer(marker)
  }
  const total = state.photos.length
  const unlocated = total - located.length
  $('pd-count').textContent = `${total} photograph${total === 1 ? '' : 's'}${unlocated ? ` · ${unlocated} without a location` : ''}`
  $('pd-map-empty').hidden = located.length > 0
  if (total && !located.length) {
    $('pd-map-empty').querySelector('h2').textContent = 'These moments have no map pins.'
    $('pd-map-empty').querySelector('p').textContent = 'Their locations weren’t recorded. Find every photograph in Stack.'
  } else {
    $('pd-map-empty').querySelector('h2').textContent = 'A little room for everywhere.'
    $('pd-map-empty').querySelector('p').textContent = 'Your photographs will find their places here.'
  }
  renderStacks()
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
    entry.dataReady = true
    if (!tiles.isLoading()) entry.tilesReady = true
    revealMap()
    if (state.controller === controller) {
      $('pd-refresh').disabled = false
      $('pd-refresh').textContent = 'Refresh'
      $('photodump').removeAttribute('aria-busy')
    }
  }
}

const dialog = $('pd-dialog')
function showDialog(trigger) {
  if (dialog.open) return
  state.dialogTrigger = trigger || document.activeElement
  dialog.showModal()
}
function openPhoto(photo, collection, trigger) {
  state.dialogPhotos = [...collection].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
  state.dialogIndex = state.dialogPhotos.findIndex(item => item.id === photo.id)
  state.dialogMode = 'photo'
  state.dialogTitle = 'Photographs'
  renderDialog()
  showDialog(trigger)
}
function openCollection(photos, title, trigger) {
  state.dialogPhotos = photos
  state.dialogTitle = title
  state.dialogMode = 'grid'
  renderDialog()
  showDialog(trigger)
}
function showCollectionGrid() {
  state.dialogMode = 'grid'
  renderDialog()
  $('pd-dialog-grid-view').querySelector('button')?.focus({ preventScroll: true })
}
function renderDialog() {
  const gridMode = state.dialogMode === 'grid'
  dialog.dataset.view = state.dialogMode
  $('pd-dialog-label').textContent = state.dialogTitle
  $('pd-dialog-grid-view').hidden = !gridMode
  $('pd-dialog-photo-view').hidden = gridMode
  $('pd-dialog-grid').hidden = gridMode || state.dialogPhotos.length < 2
  if (gridMode) {
    $('pd-dialog-count').textContent = `${state.dialogPhotos.length} photographs`
    $('pd-dialog-image').removeAttribute('src')
    const grid = $('pd-dialog-grid-view')
    grid.replaceChildren(...state.dialogPhotos.map(photo => {
      const button = photoButton(photo, state.dialogPhotos)
      button.addEventListener('click', () => { $('pd-dialog-close').focus({ preventScroll: true }) })
      return button
    }))
    return
  }
  const photo = state.dialogPhotos[state.dialogIndex]
  $('pd-dialog-image').hidden = false
  $('pd-image-error').hidden = true
  $('pd-dialog-image').src = photo.imageUrl
  $('pd-dialog-image').alt = `Photograph taken ${dateLong.format(new Date(photo.capturedAt))}`
  $('pd-dialog-caption').textContent = dateLong.format(new Date(photo.capturedAt))
  $('pd-dialog-count').textContent = `${state.dialogIndex + 1} / ${state.dialogPhotos.length}`
  $('pd-previous').disabled = state.dialogIndex === 0
  $('pd-next').disabled = state.dialogIndex === state.dialogPhotos.length - 1
}
function stepPhoto(direction) {
  if (state.dialogMode !== 'photo') return
  const index = state.dialogIndex + direction
  if (index < 0 || index >= state.dialogPhotos.length) return
  const focused = document.activeElement
  state.dialogIndex = index
  renderDialog()
  if (focused?.disabled) $('pd-dialog-close').focus({ preventScroll: true })
}
dialog.addEventListener('close', () => {
  $('pd-dialog-image').removeAttribute('src')
  $('pd-dialog-grid-view').replaceChildren()
  state.dialogTrigger?.isConnected && state.dialogTrigger.focus({ preventScroll: true })
})
let backdropPointerDown = false
dialog.addEventListener('pointerdown', event => { backdropPointerDown = event.target === dialog }, { passive: true })
dialog.addEventListener('click', event => { if (event.target === dialog && backdropPointerDown) dialog.close() })
dialog.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') stepPhoto(-1)
  if (event.key === 'ArrowRight') stepPhoto(1)
  if (event.key === 'Tab') {
    const controls = [...dialog.querySelectorAll('button:not(:disabled)')].filter(button => button.getClientRects().length)
    const first = controls[0], last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
})
$('pd-dialog-image').addEventListener('error', () => { $('pd-dialog-image').hidden = true; $('pd-image-error').hidden = false })
$('pd-dialog-close').addEventListener('click', () => dialog.close())
$('pd-dialog-grid').addEventListener('click', showCollectionGrid)
$('pd-previous').addEventListener('click', () => stepPhoto(-1))
$('pd-next').addEventListener('click', () => stepPhoto(1))
$('pd-map-button').addEventListener('click', () => setView('map'))
$('pd-stack-button').addEventListener('click', () => setView('stack'))
$('pd-refresh').addEventListener('click', refresh)
$('pd-retry').addEventListener('click', refresh)
$('pd-fit').addEventListener('click', fitPhotos)
$('pd-zoom-in').addEventListener('click', () => map.zoomIn(1, { animate: false }))
$('pd-zoom-out').addEventListener('click', () => map.zoomOut(1, { animate: false }))
await refresh()
