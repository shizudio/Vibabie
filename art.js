/**
 * art.js — Stacked "vinyl crate" carousel
 * Artworks overlap like a deck: gaps widen toward the centred piece and
 * compress toward the edges (tanh spacing), so neighbours tuck behind the
 * focused work while still peeking out. The line ends in a sketch pile that
 * opens a grid modal. Scroll / drag / arrows move the focus; it snaps.
 */

import { initLightbox } from './lightbox.js'

// ── Load manifest (tolerate both the new {artworks,sketches} shape and a
//    legacy flat array, in case a stale copy is served from CDN cache) ──
const data = await (await fetch('art-manifest-v2.json')).json()
const ARTWORKS = Array.isArray(data) ? data : (data.artworks || [])
const SKETCHES = Array.isArray(data) ? [] : (data.sketches || [])
const N = ARTWORKS.length            // pile lives at index N

// ── DOM refs ──────────────────────────────────────────────
const viewport = document.getElementById('viewport')
const track    = document.getElementById('track')
const railLine = document.getElementById('rail-line')
const railFill = document.getElementById('rail-fill')
const railCount= document.getElementById('rail-count')
const capTitle = document.getElementById('deck-caption-title')
const capMeta  = document.getElementById('deck-caption-meta')

const lightbox  = document.getElementById('art-lightbox')
const lbImg     = document.getElementById('art-lb-img')
const lbCaption = document.getElementById('art-lb-caption')
const lbClose   = document.getElementById('art-lb-close')
const { open: openLightbox } = initLightbox(lightbox, lbImg, lbCaption, lbClose)

const sketchModal = document.getElementById('sketch-modal')
const sketchClose = document.getElementById('sketch-modal-close')
const sketchGrid  = document.getElementById('sketch-grid')

const pad = n => String(n).padStart(2, '0')
const parseYear = m => (m.match(/\b(19|20)\d{2}\b/) || [''])[0]
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

// ── Responsive tuning ─────────────────────────────────────
let L = {}
let mobileLayout = false
const prefersCoarsePointer = () => window.matchMedia('(pointer: coarse)').matches

function computeLayout() {
  const vw = window.innerWidth
  mobileLayout = vw <= 767
  if (mobileLayout) {
    const cardMax = vw * 0.72
    L = { cardMax, pileMax: vw * 0.58, step: 260, spread: vw * 0.40, steep: 0.72 }
  } else {
    const cardMax = Math.min(vw * 0.37, 576)
    L = { cardMax, pileMax: cardMax * 0.78, step: 320, spread: vw * 0.35, steep: 0.62 }
  }
}

// ── Build deck ────────────────────────────────────────────
const items = []        // { el, index, isPile }
let pileEl = null

function buildTrack() {
  track.innerHTML = ''
  items.length = 0
  computeLayout()

  ARTWORKS.forEach((art, i) => {
    const card = document.createElement('figure')
    card.className = 'art-card'
    card.style.setProperty('--card-max', L.cardMax + 'px')
    card.dataset.index = i
    card.innerHTML = `
      <div class="art-card-frame">
        <img src="${art.src}" alt="${art.title}" loading="${i < 4 ? 'eager' : 'lazy'}" decoding="async" draggable="false" />
      </div>
      <figcaption class="art-card-cap">
        <span class="art-card-num">${pad(i + 1)}</span>
        <span class="art-card-title">${art.title}${parseYear(art.meta) ? ` <span class="art-card-year">${parseYear(art.meta)}</span>` : ''}</span>
      </figcaption>
    `
    card.querySelector('img').addEventListener('click', () => openLightbox(art.src, art.description || art.title))
    track.appendChild(card)
    items.push({ el: card, index: i, isPile: false })
  })

  // ── Sketch pile (index N) ──
  pileEl = document.createElement('div')
  pileEl.className = 'sketch-pile'
  pileEl.style.setProperty('--card-max', L.pileMax + 'px')
  pileEl.dataset.index = N
  pileEl.innerHTML = `
    <div class="sketch-pile-stack">
      ${SKETCHES.slice(0, 5).map((s, k) => `
        <img class="sketch-pile-layer" style="--k:${k}" src="${s.src}" alt="${s.title || 'sketch'}" loading="lazy" decoding="async" draggable="false" />
      `).join('')}
    </div>
    <figcaption class="sketch-pile-cap">
      <span class="art-card-num">${pad(N + 1)}</span>
      <span class="art-card-title">The Sketchbook <span class="art-card-year">${SKETCHES.length}</span></span>
      <span class="sketch-pile-hint">click to open ↗</span>
    </figcaption>
  `
  pileEl.addEventListener('click', openSketchModal)
  track.appendChild(pileEl)
  items.push({ el: pileEl, index: N, isPile: true })

  // Scrollable range: N steps from first piece to the pile
  track.style.width = (N * L.step + viewport.clientWidth) + 'px'

  buildRail()
}

// ── Bottom rail ───────────────────────────────────────────
let ticks = []
function buildRail() {
  ticks.forEach(t => t.remove())
  ticks = []
  const total = N + 1
  for (let i = 0; i < total; i++) {
    const tick = document.createElement('button')
    tick.className = 'rail-tick'
    tick.style.left = (i / (total - 1)) * 100 + '%'
    tick.setAttribute('aria-label', i < N ? ARTWORKS[i].title : 'Sketchbook')
    tick.addEventListener('click', () => scrollToIndex(i))
    railLine.appendChild(tick)
    ticks.push(tick)
  }
}

// ── Focus-driven layout (the deck math) ───────────────────
let activeIndex = -1
function render() {
  const focus  = clamp(viewport.scrollLeft / L.step, 0, N)
  // anchor everything to the viewport centre (cards live inside the scroller,
  // so we add scrollLeft to keep them visually fixed while focus drives layout)
  const anchor = viewport.scrollLeft + viewport.clientWidth / 2

  items.forEach(({ el, index }) => {
    const off  = index - focus
    const aoff = Math.abs(off)
    if (mobileLayout && aoff > 3.25) {
      el.style.visibility = 'hidden'
      return
    }
    el.style.visibility = 'visible'
    const t    = Math.tanh(off * L.steep)         // spacing curve: steep at centre
    const x     = L.spread * t                     // horizontal offset (px)
    // neighbours fall off; the focal piece gets a +20% boost that fades by one slot
    const scale = Math.max(0.70, 1 - Math.min(aoff, 5) * 0.06) + 0.2 * Math.max(0, 1 - aoff)
    const rot   = -t * 7                            // slight coverflow tilt
    const y     = Math.min(aoff, 4) * 5             // tiny recede downward
    // keep every image opaque; signify depth with a gentle darkening instead
    const bright = Math.max(0.74, 1 - Math.min(aoff, 5) * 0.055)
    el.style.transform = `translate3d(calc(${anchor + x}px - 50%), calc(-50% + ${y}px), 0) rotate(${rot}deg) scale(${scale})`
    el.style.opacity = 1
    el.style.filter = mobileLayout || aoff < 0.5 ? 'none' : `brightness(${bright})`
    el.style.zIndex = String(1000 - Math.round(aoff * 100))
  })

  const max = viewport.scrollWidth - viewport.clientWidth
  railFill.style.transform = `scaleX(${max > 0 ? viewport.scrollLeft / max : 0})`

  const near = Math.round(focus)
  if (near !== activeIndex) setActive(near)
}

function setActive(i) {
  activeIndex = i
  items.forEach(({ el, index }) => el.classList.toggle('is-active', index === i))
  ticks.forEach((t, k) => t.classList.toggle('is-active', k === i))
  railCount.textContent = `${pad(i + 1)} / ${pad(N + 1)}`
  if (i >= N) {
    capTitle.textContent = 'The Sketchbook'
    capMeta.textContent  = `Loose studies · ${SKETCHES.length}`
  } else {
    capTitle.textContent = ARTWORKS[i].title
    capMeta.textContent  = ARTWORKS[i].meta || ''
  }
}

// ── Scroll, snap, render loop ─────────────────────────────
let rafPending = false, snapTimer = null, snapAnim = null
function onScroll() {
  if (!rafPending) { requestAnimationFrame(() => { render(); rafPending = false }); rafPending = true }
  // schedule a gentle snap once the user stops scrolling (not while dragging or
  // already animating a snap, so they never fight each other)
  if (!dragging && !snapAnim) { clearTimeout(snapTimer); snapTimer = setTimeout(snap, mobileLayout ? 220 : 140) }
}
function cancelSnap() { if (snapAnim) { cancelAnimationFrame(snapAnim); snapAnim = null } }

// Custom eased tween — smoother than native scrollTo for short snap distances
function animateScrollTo(target, duration = 520) {
  cancelSnap()
  const start = viewport.scrollLeft
  const dist  = target - start
  if (Math.abs(dist) < 1) return
  const runTime = mobileLayout ? Math.min(duration, 360) : duration
  const t0 = performance.now()
  const ease = p => 1 - Math.pow(1 - p, 3)            // easeOutCubic
  const tick = now => {
    const p = Math.min(1, (now - t0) / runTime)
    viewport.scrollLeft = start + dist * ease(p)
    snapAnim = p < 1 ? requestAnimationFrame(tick) : null
  }
  snapAnim = requestAnimationFrame(tick)
}
function snap() {
  animateScrollTo(Math.round(viewport.scrollLeft / L.step) * L.step)
}
function scrollToIndex(i) {
  animateScrollTo(clamp(i, 0, N) * L.step)
}
viewport.addEventListener('scroll', onScroll)

// vertical wheel → horizontal
viewport.addEventListener('wheel', e => {
  if (sketchModal.classList.contains('open')) return
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { cancelSnap(); viewport.scrollLeft += e.deltaY; e.preventDefault() }
}, { passive: false })

// drag to scroll
let dragging = false, dragStartX = 0, dragStartScroll = 0, moved = 0
viewport.addEventListener('pointerdown', e => {
  if (prefersCoarsePointer()) return
  cancelSnap()
  dragging = true; moved = 0
  dragStartX = e.clientX; dragStartScroll = viewport.scrollLeft
  viewport.classList.add('dragging')
})
window.addEventListener('pointermove', e => {
  if (!dragging) return
  const dx = e.clientX - dragStartX
  moved = Math.max(moved, Math.abs(dx))
  viewport.scrollLeft = dragStartScroll - dx
})
window.addEventListener('pointerup', () => {
  if (!dragging) return
  dragging = false
  viewport.classList.remove('dragging')
  clearTimeout(snapTimer); snapTimer = setTimeout(snap, 60)
})
// suppress click after a real drag
viewport.addEventListener('click', e => {
  if (moved > 8) { e.stopPropagation(); e.preventDefault() }
}, true)

// keyboard
document.addEventListener('keydown', e => {
  if (sketchModal.classList.contains('open') || lightbox.classList.contains('open')) return
  if (e.key === 'ArrowRight') { e.preventDefault(); scrollToIndex(activeIndex + 1) }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); scrollToIndex(activeIndex - 1) }
})

// ── Sketch grid modal ─────────────────────────────────────
function buildSketchGrid() {
  sketchGrid.innerHTML = SKETCHES.map((s, i) => `
    <button class="sketch-cell" data-index="${i}" style="--d:${i}">
      <img src="${s.src}" alt="${s.title || 'sketch'}" loading="lazy" decoding="async" />
      ${s.title ? `<span class="sketch-cell-label">${s.title}</span>` : ''}
    </button>
  `).join('')
  sketchGrid.querySelectorAll('.sketch-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const s = SKETCHES[+cell.dataset.index]
      openLightbox(s.src, s.description || s.title || '')
    })
  })
}
function openSketchModal() {
  sketchModal.classList.add('open')
  sketchModal.setAttribute('aria-hidden', 'false')
  document.body.style.overflow = 'hidden'
}
function closeSketchModal() {
  sketchModal.classList.remove('open')
  sketchModal.setAttribute('aria-hidden', 'true')
  document.body.style.overflow = ''
}
sketchClose.addEventListener('click', closeSketchModal)
sketchModal.addEventListener('click', e => { if (e.target === sketchModal) closeSketchModal() })
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && sketchModal.classList.contains('open')) closeSketchModal()
})

// ── Init ──────────────────────────────────────────────────
buildTrack()
buildSketchGrid()
render()

let resizeTimer
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => { buildTrack(); render() }, 150)
})
