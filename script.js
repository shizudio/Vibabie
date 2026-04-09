import { inject } from '@vercel/analytics'
import { initRouter } from './router.js'
inject()
initRouter()

/* ─────────────────────────────────────────
   Shina - Global Scripts
   ───────────────────────────────────────── */

// ── VERCEL WEB ANALYTICS ──────────────────
import { inject } from '@vercel/analytics';
inject();

// ── CUSTOM CURSOR (used on all pages) ────
const cursor = document.getElementById('cursor')
cursor.innerHTML = '<span class="cursor-inner">♥</span>'
const cursorInner = cursor.querySelector('.cursor-inner')

/**
 * Smooth morph: heart grows into circle, text swaps mid-transition.
 * Single element — CSS transitions handle the size/background morph.
 */
let morphTimer = null

window.cursorMorphTo = function(emoji) {
  if (cursor.classList.contains('emoji-cursor') && cursorInner.textContent === emoji) return
  clearTimeout(morphTimer)

  // Start the circle grow immediately
  cursor.className = 'cursor emoji-cursor'
  // Swap text slightly after circle begins growing
  morphTimer = setTimeout(() => {
    cursorInner.textContent = emoji
  }, 100)
}

window.cursorMorphBack = function() {
  if (cursor.classList.contains('default-cursor')) return
  clearTimeout(morphTimer)

  // Shrink circle back to heart size
  cursor.className = 'cursor default-cursor'
  // Swap text back mid-shrink
  morphTimer = setTimeout(() => {
    cursorInner.textContent = '♥'
  }, 100)
}

// ── ADAPTIVE CURSOR COLOUR ────────────────
// Samples the image pixel under the cursor and picks the
// highest-contrast colour from: crimson / white / ink-black.
// Only commits after the mouse has "rested" for SETTLE_MS
// so fast sweeps don't flicker.

const SETTLE_MS = 150
const CANDIDATES = [
  { color: '#7F1F12', r: 127, g: 31,  b: 18  },
  { color: '#FFFFFF', r: 255, g: 255, b: 255 },
  { color: '#1a1614', r: 26,  g: 22,  b: 20  },
]

function _linearize(c) {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}
function _lum(r, g, b) {
  return 0.2126 * _linearize(r) + 0.7152 * _linearize(g) + 0.0722 * _linearize(b)
}
function _bestColor(r, g, b) {
  const bg = _lum(r, g, b)
  let best = CANDIDATES[0], top = 0
  for (const c of CANDIDATES) {
    const l = _lum(c.r, c.g, c.b)
    const ratio = (Math.max(l, bg) + 0.05) / (Math.min(l, bg) + 0.05)
    if (ratio > top) { top = ratio; best = c }
  }
  return best.color
}

const _canvasCache = new WeakMap()
function _getCanvas(img) {
  if (_canvasCache.has(img)) return _canvasCache.get(img)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const entry = { canvas, ctx }
  _canvasCache.set(img, entry)
  return entry
}

function _samplePixel(img, el, cx, cy) {
  const rect = el.getBoundingClientRect()
  const nw = img.naturalWidth, nh = img.naturalHeight
  if (!nw || !nh) return null
  const scale = Math.max(rect.width / nw, rect.height / nh)
  const offX  = (nw * scale - rect.width)  / 2
  const offY  = (nh * scale - rect.height) / 2
  const px = Math.round((cx - rect.left + offX) / scale)
  const py = Math.round((cy - rect.top  + offY) / scale)
  try {
    const [r, g, b] = _getCanvas(img).ctx.getImageData(px, py, 1, 1).data
    return { r, g, b }
  } catch { return null }
}

window.attachAdaptiveCursor = attachAdaptiveCursor
function attachAdaptiveCursor(img) {
  if (img._adaptiveBound) return   // already attached
  img._adaptiveBound = true
  const el = img.parentElement
  let timer = null, pending = null

  img.addEventListener('mousemove', (e) => {
    if (cursor.classList.contains('emoji-cursor')) return  // don't override zone hover
    const px = _samplePixel(img, el, e.clientX, e.clientY)
    if (!px) return
    const color = _bestColor(px.r, px.g, px.b)
    if (color === cursor.style.color) return
    pending = color
    clearTimeout(timer)
    timer = setTimeout(() => { cursor.style.color = pending }, SETTLE_MS)
  })

  img.addEventListener('mouseleave', () => {
    clearTimeout(timer)
    pending = null
    if (!cursor.classList.contains('emoji-cursor')) {
      cursor.style.color = '#7F1F12'
    }
  })
}

// Attach to all existing images
document.querySelectorAll('img').forEach(attachAdaptiveCursor)

// Watch for images added dynamically (e.g. cosmos.js rendering)
new MutationObserver(mutations => {
  for (const m of mutations) {
    m.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return
      if (node.tagName === 'IMG') attachAdaptiveCursor(node)
      node.querySelectorAll?.('img').forEach(attachAdaptiveCursor)
    })
  }
}).observe(document.body, { childList: true, subtree: true })

document.addEventListener('mousemove', (e) => {
  cursor.style.left = e.clientX + 'px'
  cursor.style.top = e.clientY + 'px'

  // Move tooltip if it exists (index page only)
  const tooltip = document.getElementById('tooltip')
  if (!tooltip) return

  const ttW = tooltip.offsetWidth
  const ttH = tooltip.offsetHeight
  let tx = e.clientX + 36
  let ty = e.clientY - ttH / 2

  // Flip left if near right edge
  if (tx + ttW > window.innerWidth - 20) tx = e.clientX - ttW - 36
  // Keep within vertical bounds
  if (ty < 10) ty = 10
  if (ty + ttH > window.innerHeight - 10) ty = window.innerHeight - ttH - 10

  tooltip.style.left = tx + 'px'
  tooltip.style.top = ty + 'px'
})

const portraitFrame = document.getElementById('portraitFrame');
const portraitVid = portraitFrame?.querySelector('.portrait-vid');

if (portraitFrame && portraitVid) {
  portraitFrame.addEventListener('mouseenter', () => {
    portraitVid.currentTime = 0;
    portraitVid.play();
  });
  portraitFrame.addEventListener('mouseleave', () => {
    portraitVid.pause();
  });
}

