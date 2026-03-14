/* ─────────────────────────────────────────
   photography.js — Adaptive cursor colour
   ───────────────────────────────────────── */

// Candidate cursor colours: crimson, white, ink-black
const CANDIDATES = [
  { color: '#7F1F12', r: 127, g: 31,  b: 18  },  // crimson
  { color: '#FFFFFF', r: 255, g: 255, b: 255 },  // white
  { color: '#1a1614', r: 26,  g: 22,  b: 20  },  // ink
]

function linearize(c) {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function luminance(r, g, b) {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2)
  const darker  = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function bestColor(bgR, bgG, bgB) {
  const bgL = luminance(bgR, bgG, bgB)
  let best = CANDIDATES[0], bestRatio = 0
  for (const c of CANDIDATES) {
    const ratio = contrastRatio(luminance(c.r, c.g, c.b), bgL)
    if (ratio > bestRatio) { bestRatio = ratio; best = c }
  }
  return best.color
}

// Build an offscreen canvas per grid image for pixel sampling
const canvasCache = new WeakMap()

function getCanvas(img) {
  if (canvasCache.has(img)) return canvasCache.get(img)
  const canvas = document.createElement('canvas')
  canvas.width  = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  canvasCache.set(img, { canvas, ctx })
  return { canvas, ctx }
}

// Map cursor-relative position to pixel inside the cover-fitted image
function samplePixel(img, el, cursorX, cursorY) {
  const rect   = el.getBoundingClientRect()
  const dw     = rect.width
  const dh     = rect.height
  const nw     = img.naturalWidth
  const nh     = img.naturalHeight
  if (!nw || !nh) return null

  const scale  = Math.max(dw / nw, dh / nh)
  const offX   = (nw * scale - dw) / 2
  const offY   = (nh * scale - dh) / 2

  const relX   = cursorX - rect.left
  const relY   = cursorY - rect.top
  const px     = Math.round((relX + offX) / scale)
  const py     = Math.round((relY + offY) / scale)

  try {
    const { ctx } = getCanvas(img)
    const [r, g, b] = ctx.getImageData(px, py, 1, 1).data
    return { r, g, b }
  } catch {
    return null
  }
}

// Attach adaptive cursor logic to all grid images
// Colour only commits after the mouse has "rested" on a region for SETTLE_MS —
// fast sweeps sample continuously but never apply a half-way colour.
const SETTLE_MS = 150
const cursor = document.getElementById('cursor')

document.querySelectorAll('.grid-item img').forEach(img => {
  const el = img.parentElement
  let debounceTimer = null
  let pendingColor  = null

  function onMove(e) {
    const pixel = samplePixel(img, el, e.clientX, e.clientY)
    if (!pixel) return

    const color = bestColor(pixel.r, pixel.g, pixel.b)
    if (color === cursor.style.color) return   // already correct, nothing to do

    pendingColor = color
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      cursor.style.color = pendingColor
    }, SETTLE_MS)
  }

  el.addEventListener('mousemove', onMove)
  el.addEventListener('mouseleave', () => {
    clearTimeout(debounceTimer)
    pendingColor = null
    cursor.style.color = '#7F1F12'  // reset to default crimson
  })
})
