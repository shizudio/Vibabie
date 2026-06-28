/**
 * art.js — Stacked "vinyl crate" carousel
 * Artworks overlap like a deck: gaps widen toward the centred piece and
 * compress toward the edges (tanh spacing), so neighbours tuck behind the
 * focused work while still peeking out. The line ends in a sketch pile that
 * opens a grid modal. Scroll / drag / arrows move the focus; it snaps.
 */

import { initLightbox } from './lightbox.js'

// ── Load manifest ─────────────────────────────────────────
const data = await (await fetch('art-manifest.json')).json()
const ARTWORKS = data.artworks || []
const SKETCHES = data.sketches || []
const N = ARTWORKS.length            // pile lives at index N

// ── DOM refs ──────────────────────────────────────────────
const viewport = document.getElementById('viewport')
const track    = document.getElementById('track')
const railLine = document.getElementById('rail-line')
const railFill = document.getElementById('rail-fill')
const railCount= document.getElementById('rail-count')
const railTitle= document.getElementById('rail-title')

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
function computeLayout() {
  const vw = window.innerWidth
  if (vw <= 767) {
    const cardMax = vw * 0.80
    L = { cardMax, pileMax: vw * 0.62, step: 260, spread: cardMax * 0.40, steep: 0.7 }
  } else {
    const cardMax = Math.min(vw * 0.40, 560)
    L = { cardMax, pileMax: cardMax * 0.78, step: 300, spread: cardMax * 0.42, steep: 0.7 }
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
        <img src="${art.src}" alt="${art.title}" loading="${i < 4 ? 'eager' : 'lazy'}" draggable="false" />
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
        <img class="sketch-pile-layer" style="--k:${k}" src="${s.src}" alt="${s.title || 'sketch'}" loading="lazy" draggable="false" />
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
    const t    = Math.tanh(off * L.steep)         // spacing curve: steep at centre
    const x     = L.spread * t                     // horizontal offset (px)
    const scale = Math.max(0.70, 1 - Math.min(aoff, 5) * 0.06)
    const rot   = -t * 7                            // slight coverflow tilt
    const y     = Math.min(aoff, 4) * 5             // tiny recede downward
    const op    = Math.max(0.32, 1 - Math.min(aoff, 6) * 0.12)
    el.style.left = (anchor + x) + 'px'
    el.style.transform = `translate(-50%, -50%) translate(0, ${y}px) rotate(${rot}deg) scale(${scale})`
    el.style.opacity = op
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
  railTitle.textContent = i >= N ? 'The Sketchbook' : ARTWORKS[i].title
}

// ── Scroll, snap, render loop ─────────────────────────────
let rafPending = false, snapTimer = null
function onScroll() {
  if (!rafPending) { requestAnimationFrame(() => { render(); rafPending = false }); rafPending = true }
  if (!dragging) { clearTimeout(snapTimer); snapTimer = setTimeout(snap, 150) }
}
function snap() {
  const target = Math.round(viewport.scrollLeft / L.step) * L.step
  if (Math.abs(target - viewport.scrollLeft) > 2) viewport.scrollTo({ left: target, behavior: 'smooth' })
}
function scrollToIndex(i) {
  viewport.scrollTo({ left: clamp(i, 0, N) * L.step, behavior: 'smooth' })
}
viewport.addEventListener('scroll', onScroll)

// vertical wheel → horizontal
viewport.addEventListener('wheel', e => {
  if (sketchModal.classList.contains('open')) return
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { viewport.scrollLeft += e.deltaY; e.preventDefault() }
}, { passive: false })

// drag to scroll
let dragging = false, dragStartX = 0, dragStartScroll = 0, moved = 0
viewport.addEventListener('pointerdown', e => {
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
      <img src="${s.src}" alt="${s.title || 'sketch'}" loading="lazy" />
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
