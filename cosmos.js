import { initLightbox } from './lightbox.js'
import { extractColors, aggregatePalette } from './colorExtract.js'

const data = await fetch('./cosmos-data.json')
  .then(r => r.json())
  .catch(() => ({ elements: [], title: '', lastUpdated: null }))

const grid        = document.getElementById('cosmos-grid')
const titleEl     = document.getElementById('cosmos-title')
const updatedEl   = document.getElementById('cosmos-updated')
const lightbox    = document.getElementById('lightbox')
const lbImg       = document.getElementById('lightbox-img')
const lbClose     = document.getElementById('lightbox-close')
const paletteEl   = document.getElementById('cosmos-palette')
const paletteSect = document.getElementById('cosmos-palette-section')

// ── Collection title ────────────────────────────────────────────────────────
if (titleEl && data.title) titleEl.textContent = data.title

// ── Last updated ────────────────────────────────────────────────────────────
if (updatedEl && data.lastUpdated) {
  const d = new Date(data.lastUpdated)
  updatedEl.textContent = `Updated ${d.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  })}`
}

// ── sessionStorage palette cache key ─────────────────────────────────────────
const PALETTE_CACHE_KEY = 'cosmos_palette_v2'

// ── Global palette aggregation ───────────────────────────────────────────────
// Collect per-image colour arrays; aggregatePalette() merges them all at once.
const allColorArrays = []
let   paletteTimer   = null

function addToGlobalPalette(colours) {
  allColorArrays.push(colours)
  clearTimeout(paletteTimer)
  paletteTimer = setTimeout(renderGlobalPalette, 200)
}

function _rgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  ]
}

function _isBlack(hex) { const [r, g, b] = _rgb(hex); return r < 48 && g < 48 && b < 48 }
function _isWhite(hex) { const [r, g, b] = _rgb(hex); return r > 180 && g > 180 && b > 180 }
function _isRed(hex)   { const [r, g, b] = _rgb(hex); return r > 50 && r > g * 1.5 && r > b * 1.5 }

function renderGlobalPalette() {
  const top = aggregatePalette(allColorArrays, 20)
    .filter(({ hex }) => !_isBlack(hex) && !_isWhite(hex))
    .slice(0, 9)
    .sort((a, b) => {
      // Crimson/red hues always lead
      const ra = _isRed(a.hex), rb = _isRed(b.hex)
      if (ra && !rb) return -1
      if (!ra && rb) return 1
      return b.count - a.count
    })

  // Persist to sessionStorage for subsequent page loads
  try {
    sessionStorage.setItem(PALETTE_CACHE_KEY, JSON.stringify(top))
  } catch (_) { /* quota exceeded — silently skip */ }

  renderSwatches(top)
}

function renderSwatches(palette) {
  paletteEl.innerHTML = ''
  palette.forEach(({ hex, count }) => {
    const swatch = document.createElement('div')
    swatch.className = 'palette-swatch'
    swatch.style.background = hex
    swatch.style.flex = count
    swatch.dataset.hex = hex
    paletteEl.appendChild(swatch)
  })
  paletteSect.classList.add('ready')
}

// ── sessionStorage palette cache ─────────────────────────────────────────────
let cachedPalette = null

try {
  const raw = sessionStorage.getItem(PALETTE_CACHE_KEY)
  if (raw) cachedPalette = JSON.parse(raw)
} catch (_) { /* ignore parse errors */ }

// ── Render masonry grid ─────────────────────────────────────────────────────
const PREVIEW_COUNT = 12

function renderItem(el, i) {
  const item = document.createElement('div')
  item.className = 'cosmos-item'
  item.style.animationDelay = `${i * 0.045}s`

  const img = document.createElement('img')
  img.crossOrigin = 'anonymous'
  img.src      = el.url
  img.alt      = ''
  img.loading  = i < 6 ? 'eager' : 'lazy'
  img.decoding = 'async'

  if (el.width && el.height) {
    img.width  = el.width
    img.height = el.height
  }

  if (!cachedPalette) {
    img.addEventListener('load', () => addToGlobalPalette(extractColors(img)))
  }

  item.appendChild(img)
  item.addEventListener('click', () => openLightbox(el.url, img))
  return item
}

// Render preview items only
data.elements.slice(0, PREVIEW_COUNT).forEach((el, i) => {
  grid.appendChild(renderItem(el, i))
})

// If a cached palette exists, render it immediately without re-extraction
if (cachedPalette) {
  renderSwatches(cachedPalette)
}

// Staggered fade-in via IntersectionObserver
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible')
      observer.unobserve(entry.target)
    }
  })
}, { threshold: 0.05 })

document.querySelectorAll('.cosmos-item').forEach(el => observer.observe(el))

// ── See all bar ──────────────────────────────────────────────────────────────
const remaining = data.elements.slice(PREVIEW_COUNT)
if (remaining.length > 0) {
  const seeAllBar = document.createElement('div')
  seeAllBar.className = 'cosmos-see-all-bar'

  const seeAllBtn = document.createElement('button')
  seeAllBtn.className = 'cosmos-see-all-btn'
  seeAllBtn.textContent = `See all ${data.elements.length} images that inspired Shina`
  seeAllBar.appendChild(seeAllBtn)

  const footer = document.querySelector('.cosmos-footer')
  footer.insertAdjacentElement('beforebegin', seeAllBar)

  seeAllBtn.addEventListener('click', () => {
    remaining.forEach((el, i) => {
      const item = renderItem(el, PREVIEW_COUNT + i)
      grid.appendChild(item)
      observer.observe(item)
    })
    seeAllBar.remove()
  })
}

// ── Lightbox ────────────────────────────────────────────────────────────────
const { open: _lbOpen } = initLightbox(lightbox, lbImg, null, lbClose)

function openLightbox(src, srcImg) {
  // Use the already-loaded thumbnail dimensions for placeholder sizing
  if (srcImg?.naturalWidth) {
    lbImg.width  = srcImg.naturalWidth
    lbImg.height = srcImg.naturalHeight
  }
  _lbOpen(src)
}
