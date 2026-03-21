import { initLightbox } from './lightbox.js'

// ── Artwork data — loaded from art-manifest.json ───────────────────────────
// Run `node sync-art.js` after adding new files to Art/ to update the manifest.
const manifestResp = await fetch('art-manifest.json')
const ARTWORKS = (await manifestResp.json()).map(a => ({ ...a, aspect: 'auto' }))

// ── Mobile detection ───────────────────────────────────────────────────────
// Checks are run once at load; resize listener updates if orientation changes.
function isMobile() { return window.innerWidth <= 767 }

// ── Constants (responsive) ─────────────────────────────────────────────────
// On mobile: smaller cards (36vh) so they stay within the viewport,
//            tighter spread (clamp to 42% of viewport width) so side cards
//            don't bleed off-screen on 375px devices.
function getConstants() {
  const mobile = isMobile()
  return {
    CARD_HEIGHT_VH: mobile ? 36  : 52,     // vh
    SPREAD:         mobile ? Math.min(120, window.innerWidth * 0.30) : 190,  // px
    ROTATE_STEP:    mobile ? 4   : 5,      // deg
    SCALE_STEP:     mobile ? 0.10 : 0.08,  // per step
    OPACITY_STEP:   mobile ? 0.22 : 0.18,  // per step
    DRAG_THRESH:    mobile ? 50  : 70,     // px (easier swipe on touch)
    COOLDOWN_MS:    480,
  }
}

let { CARD_HEIGHT_VH, SPREAD, ROTATE_STEP, SCALE_STEP,
      OPACITY_STEP, DRAG_THRESH, COOLDOWN_MS } = getConstants()

// ── State ──────────────────────────────────────────────────────────────────
let activeIndex   = 0
let dragAccum     = 0
let lastDragX     = null
let inCooldown    = false
let isDragging    = false
let didDrag       = false

// ── Elements ───────────────────────────────────────────────────────────────
const stage      = document.getElementById('art-stage')
const labelTitle = document.getElementById('art-label-title')
const labelMeta  = document.getElementById('art-label-meta')
const counter    = document.getElementById('art-counter')
const cursor     = document.getElementById('cursor')
const lightbox   = document.getElementById('art-lightbox')
const lbImg      = document.getElementById('art-lb-img')
const lbCaption  = document.getElementById('art-lb-caption')
const lbClose    = document.getElementById('art-lb-close')

// ── Build cards ────────────────────────────────────────────────────────────
const cards = ARTWORKS.map((art, i) => {
  const card = document.createElement('div')
  card.className = 'art-card'
  card.dataset.index = i

  const img = document.createElement('img')
  img.src    = art.src
  img.alt    = art.title
  img.loading = i === 0 ? 'eager' : 'lazy'
  img.style.aspectRatio = art.aspect
  img.style.height = `${CARD_HEIGHT_VH}vh`
  img.style.width  = 'auto'

  card.appendChild(img)
  stage.appendChild(card)
  return card
})

// ── Resize: recalculate mobile constants + update card heights ──────────────
// Debounced so it doesn't fire on every pixel during a drag-resize.
let _resizeTimer
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer)
  _resizeTimer = setTimeout(() => {
    ;({ CARD_HEIGHT_VH, SPREAD, ROTATE_STEP, SCALE_STEP,
        OPACITY_STEP, DRAG_THRESH, COOLDOWN_MS } = getConstants())
    cards.forEach(card => {
      const img = card.querySelector('img')
      if (img) img.style.height = `${CARD_HEIGHT_VH}vh`
    })
    layoutCards()
  }, 120)
}, { passive: true })

// ── Layout ─────────────────────────────────────────────────────────────────
function layoutCards() {
  const n = ARTWORKS.length
  cards.forEach((card, i) => {
    const offset = i - activeIndex
    const absOff = Math.abs(offset)
    const tx      = offset * SPREAD
    const rot     = offset * ROTATE_STEP
    const scale   = Math.max(0.4, 1 - absOff * SCALE_STEP)
    const opacity = Math.max(0.12, 1 - absOff * OPACITY_STEP)
    const z       = n - absOff

    card.style.transform  = `translate(calc(-50% + ${tx}px), -50%) rotate(${rot}deg) scale(${scale})`
    card.style.opacity    = opacity
    card.style.zIndex     = z
  })
}

// ── Label ──────────────────────────────────────────────────────────────────
function updateLabel() {
  const art = ARTWORKS[activeIndex]

  // Flash out then in
  labelTitle.classList.remove('visible')
  labelMeta.classList.remove('visible')

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      labelTitle.textContent = art.title
      labelMeta.textContent  = art.meta
      labelTitle.classList.add('visible')
      labelMeta.classList.add('visible')
    })
  })

  const pad = n => String(n).padStart(2, '0')
  counter.textContent = `${pad(activeIndex + 1)} / ${pad(ARTWORKS.length)}`
}

// ── Navigate ───────────────────────────────────────────────────────────────
function navigate(dir) {
  if (inCooldown) return
  const next = activeIndex + dir
  if (next < 0 || next >= ARTWORKS.length) return

  activeIndex = next
  inCooldown  = true
  layoutCards()
  updateLabel()

  setTimeout(() => { inCooldown = false }, COOLDOWN_MS)
}

// ── Mouse drag ─────────────────────────────────────────────────────────────
stage.addEventListener('mousedown', e => {
  isDragging = true
  lastDragX  = e.clientX
  dragAccum  = 0
  stage.style.cursor = 'none'
})

window.addEventListener('mousemove', e => {
  if (!isDragging) return
  const dx = e.clientX - lastDragX
  lastDragX = e.clientX
  dragAccum += dx
  if (Math.abs(dx) > 2) didDrag = true

  if (dragAccum < -DRAG_THRESH) {
    dragAccum = 0
    navigate(1)
  } else if (dragAccum > DRAG_THRESH) {
    dragAccum = 0
    navigate(-1)
  }
})

window.addEventListener('mouseup', () => {
  isDragging = false
  lastDragX  = null
  dragAccum  = 0
  setTimeout(() => { didDrag = false }, 0)
})

// ── Cursor directional hint ────────────────────────────────────────────────
stage.addEventListener('mousemove', e => {
  if (cursor.classList.contains('emoji-cursor')) return
  const midX = stage.getBoundingClientRect().left + stage.offsetWidth / 2
  const sym  = e.clientX < midX ? '←' : '→'
  const inner = cursor.querySelector('.cursor-inner')
  if (inner && inner.textContent !== sym) inner.textContent = sym
})

stage.addEventListener('mouseleave', () => {
  const inner = cursor.querySelector('.cursor-inner')
  if (!cursor.classList.contains('emoji-cursor') && inner) inner.textContent = '♥'
})

// ── Touch swipe ────────────────────────────────────────────────────────────
let touchStartX = null

stage.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX
}, { passive: true })

stage.addEventListener('touchend', e => {
  if (touchStartX === null) return
  const dx = e.changedTouches[0].clientX - touchStartX
  touchStartX = null
  if (dx < -DRAG_THRESH) navigate(1)
  else if (dx > DRAG_THRESH) navigate(-1)
}, { passive: true })

// ── Keyboard ───────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') navigate(1)
  if (e.key === 'ArrowLeft')  navigate(-1)
})

// ── Lightbox ───────────────────────────────────────────────────────────────
const { open: openLightbox, close: closeLightbox } = initLightbox(lightbox, lbImg, lbCaption, lbClose)

// ── Card click — open lightbox if active, navigate if not ─────────────────
cards.forEach((card, i) => {
  card.addEventListener('click', () => {
    if (didDrag) return
    const offset = i - activeIndex
    if (offset === 0) {
      const art = ARTWORKS[i]
      const pad = n => String(n).padStart(2, '0')
      const caption = art.description || art.title || `${pad(i + 1)} / ${pad(ARTWORKS.length)}`
      openLightbox(card.querySelector('img').src, caption)
    } else {
      navigate(Math.sign(offset))
    }
  })
})

// ── Header fade-up ─────────────────────────────────────────────────────────
document.querySelectorAll('.reveal').forEach(el => {
  requestAnimationFrame(() => el.classList.add('visible'))
})

// ── Init ───────────────────────────────────────────────────────────────────
layoutCards()
updateLabel()
