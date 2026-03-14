import data from './cosmos-data.json'

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

// ── Colour extraction ────────────────────────────────────────────────────────
function extractColours(img, n = 5) {
  const size = 80
  const canvas = document.createElement('canvas')
  canvas.width  = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)

  // Quantise each channel to 8 levels (step of 32) → 512 possible buckets
  const buckets = {}
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue  // skip transparent
    const r = (data[i]     >> 5) << 5
    const g = (data[i + 1] >> 5) << 5
    const b = (data[i + 2] >> 5) << 5
    const key = `${r},${g},${b}`
    buckets[key] = (buckets[key] || 0) + 1
  }

  return Object.entries(buckets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key]) => {
      const [r, g, b] = key.split(',').map(Number)
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    })
}

// ── Global palette aggregation ───────────────────────────────────────────────
const palettePool = {}   // coarse-key → { hex, count }
let   paletteTimer = null

function addToGlobalPalette(colours) {
  colours.forEach(hex => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    // Coarser quantisation (step 64) merges near-identical colours across photos
    const cr = (r >> 6) << 6
    const cg = (g >> 6) << 6
    const cb = (b >> 6) << 6
    const key = `${cr},${cg},${cb}`
    if (!palettePool[key]) {
      palettePool[key] = {
        hex: `#${cr.toString(16).padStart(2, '0')}${cg.toString(16).padStart(2, '0')}${cb.toString(16).padStart(2, '0')}`,
        count: 0
      }
    }
    palettePool[key].count++
  })
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
  const top = Object.values(palettePool)
    .filter(({ hex }) => !_isBlack(hex) && !_isWhite(hex))
    .sort((a, b) => b.count - a.count)
    .slice(0, 9)
    .sort((a, b) => {
      // Crimson/red hues always lead
      const ra = _isRed(a.hex), rb = _isRed(b.hex)
      if (ra && !rb) return -1
      if (!ra && rb) return 1
      return b.count - a.count
    })

  paletteEl.innerHTML = ''
  top.forEach(({ hex, count }) => {
    const swatch = document.createElement('div')
    swatch.className = 'palette-swatch'
    swatch.style.background = hex
    swatch.style.flex = count
    swatch.dataset.hex = hex
    paletteEl.appendChild(swatch)
  })
  paletteSect.classList.add('ready')
}

// ── Render masonry grid ─────────────────────────────────────────────────────
data.elements.forEach((el, i) => {
  const item = document.createElement('div')
  item.className = 'cosmos-item'
  item.style.animationDelay = `${i * 0.045}s`


  const img = document.createElement('img')
  img.crossOrigin = 'anonymous'   // allows canvas pixel sampling for adaptive cursor
  img.src      = el.url
  img.alt      = ''
  img.loading  = i < 6 ? 'eager' : 'lazy'
  img.decoding = 'async'

  // Preserve aspect ratio via intrinsic dimensions
  if (el.width && el.height) {
    img.width  = el.width
    img.height = el.height
  }

  img.addEventListener('load', () => {
    addToGlobalPalette(extractColours(img))
  })

  item.appendChild(img)
  grid.appendChild(item)

  // Open lightbox on click
  item.addEventListener('click', () => openLightbox(el.url, img))
})

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

// ── Lightbox ────────────────────────────────────────────────────────────────
function openLightbox(src, srcImg) {
  lbImg.src = src
  // Use the already-loaded thumbnail dimensions for placeholder sizing
  if (srcImg?.naturalWidth) {
    lbImg.width  = srcImg.naturalWidth
    lbImg.height = srcImg.naturalHeight
  }
  lightbox.classList.add('open')
  lightbox.setAttribute('aria-hidden', 'false')
  document.body.style.overflow = 'hidden'
}

function closeLightbox() {
  lightbox.classList.remove('open')
  lightbox.setAttribute('aria-hidden', 'true')
  document.body.style.overflow = ''
  // Delay src clear so transition completes
  setTimeout(() => { lbImg.src = '' }, 300)
}

lbClose.addEventListener('click', closeLightbox)
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox() })
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox() })
