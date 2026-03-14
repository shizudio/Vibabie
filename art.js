// ── Artwork data ──────────────────────────────────────────────────────────
import cosmosData from './cosmos-data.json'

const ARTWORKS = cosmosData.elements.map(el => ({
  src: el.url,
  title: '',
  meta: '',
  aspect: `${el.width}/${el.height}`,
}))

// ── Constants ──────────────────────────────────────────────────────────────
const CARD_HEIGHT_VH = 52     // active card height as % of viewport height
const SPREAD        = 190     // horizontal spread per step (px)
const ROTATE_STEP   = 5       // degrees of tilt per step
const SCALE_STEP    = 0.08    // scale reduction per step
const OPACITY_STEP  = 0.18    // opacity reduction per step
const DRAG_THRESH   = 70      // px of accumulated drag to advance
const COOLDOWN_MS   = 480     // ms between advances

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
  if (cursor.textContent !== sym) cursor.textContent = sym
})

stage.addEventListener('mouseleave', () => {
  if (!cursor.classList.contains('emoji-cursor')) cursor.textContent = '♥'
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
function openLightbox(src, caption) {
  lbImg.src = src
  lbCaption.textContent = caption
  lightbox.classList.add('open')
  lightbox.setAttribute('aria-hidden', 'false')
  document.body.style.overflow = 'hidden'
}

function closeLightbox() {
  lightbox.classList.remove('open')
  lightbox.setAttribute('aria-hidden', 'true')
  document.body.style.overflow = ''
  setTimeout(() => { lbImg.src = '' }, 350)
}

lbClose.addEventListener('click', closeLightbox)
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox() })
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox() })

// ── Card click — open lightbox if active, navigate if not ─────────────────
cards.forEach((card, i) => {
  card.addEventListener('click', () => {
    if (didDrag) return
    const offset = i - activeIndex
    if (offset === 0) {
      const art = ARTWORKS[i]
      const pad = n => String(n).padStart(2, '0')
      const caption = art.title || `${pad(i + 1)} / ${pad(ARTWORKS.length)}`
      openLightbox(card.querySelector('img').src, caption)
    } else {
      navigate(Math.sign(offset))
    }
  })
})

// ── Header fade-up ─────────────────────────────────────────────────────────
document.querySelectorAll('.fade-up').forEach(el => {
  requestAnimationFrame(() => el.classList.add('visible'))
})

// ── Init ───────────────────────────────────────────────────────────────────
layoutCards()
updateLabel()
