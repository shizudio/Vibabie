import { initLightbox } from './lightbox.js'
import { hexToRgba } from './colorExtract.js'

const manifest    = await fetch('./midjourney-manifest.json')
  .then(r => r.json())
  .catch(() => ({ images: [], tags: [] }))
const carouselEl  = document.getElementById('mj-carousel')
const filtersEl   = document.getElementById('mj-filters')
const sectionEl   = document.getElementById('mj-section')
const lightbox    = document.getElementById('lightbox')
const lbImg       = document.getElementById('lightbox-img')
const lbClose     = document.getElementById('lightbox-close')

const { open: openLightbox } = initLightbox(lightbox, lbImg, null, lbClose)

const TILE    = 240  // px — matches CSS .mj-tile width/height
const OVERLAP = 48   // px — 20% overlap via negative margin-right
const SPEED   = 40   // px/s — half speed for slow-motion feel

// ── Shuffle ──────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Build carousel ────────────────────────────────────────────────────────────
function buildCarousel(images) {
  carouselEl.innerHTML = ''

  if (!images.length) return

  // Single row — pad to at least 10 items for a smooth loop
  let r1 = [...images]
  while (r1.length < 10) r1 = [...r1, ...images]

  // Duration based on effective tile width (tile - overlap) at desired speed
  const dur1 = Math.round(r1.length * (TILE - OVERLAP) / SPEED)

  carouselEl.appendChild(makeTrack([...r1, ...r1], 'mj-track--fwd', dur1))
}

function makeTrack(images, dirClass, durationSec) {
  const track = document.createElement('div')
  track.className = `mj-track ${dirClass}`
  track.style.setProperty('--mj-dur', `${durationSec}s`)

  images.forEach(item => {
    const tile = document.createElement('div')
    tile.className = 'mj-tile'

    const img = document.createElement('img')
    img.src      = item.src
    img.alt      = item.prompt || ''
    img.loading  = 'lazy'
    img.decoding = 'async'

    tile.appendChild(img)
    tile.addEventListener('click', () => openLightbox(item.src, item.prompt))

    // Magnetic follow — whole tile translates toward cursor, constrained to ±MAX_SHIFT
    const MAX_SHIFT = 6  // px
    tile.addEventListener('mouseenter', () => {
      tile.style.transition = 'transform 0.15s ease-out'
      tile.style.transform  = 'scale(1.08)'
    })
    tile.addEventListener('mousemove', e => {
      const rect = tile.getBoundingClientRect()
      const dx   = ((e.clientX - (rect.left + rect.width  / 2)) / (rect.width  / 2)) * MAX_SHIFT
      const dy   = ((e.clientY - (rect.top  + rect.height / 2)) / (rect.height / 2)) * MAX_SHIFT
      tile.style.transition = 'transform 0.1s ease-out'
      tile.style.transform  = `scale(1.08) translate(${dx}px, ${dy}px)`
    })
    tile.addEventListener('mouseleave', () => {
      tile.style.transition = 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      tile.style.transform  = ''
    })

    // Touch feedback — brief scale pulse since mouse events don't fire on touch
    tile.addEventListener('touchstart', () => {
      tile.style.transition = 'transform 0.15s ease-out'
      tile.style.transform  = 'scale(1.06)'
    }, { passive: true })
    tile.addEventListener('touchend', () => {
      tile.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      tile.style.transform  = ''
    }, { passive: true })

    track.appendChild(tile)
  })

  return track
}

const allImages   = shuffle(manifest.images)
let currentImages = allImages
let currentLabel  = 'All'
buildCarousel(allImages)

// ── Filter buttons ────────────────────────────────────────────────────────────
const allBtn = makeFilterBtn('all', 'All', 'var(--ink)')
allBtn.classList.add('active')
filtersEl.appendChild(allBtn)
manifest.tags.forEach(tag => filtersEl.appendChild(makeFilterBtn(tag.id, tag.id, tag.color)))

function makeFilterBtn(id, label, color) {
  const btn = document.createElement('button')
  btn.className = 'mj-filter'
  btn.dataset.tag = id
  btn.innerHTML =
    `<span class="mj-dot" style="background:${color}"></span>` +
    `<span class="mj-label">${label}</span>`
  return btn
}

filtersEl.addEventListener('click', e => {
  const btn = e.target.closest('.mj-filter')
  if (!btn) return

  filtersEl.querySelectorAll('.mj-filter').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')

  const activeTag = btn.dataset.tag
  const tagMeta   = manifest.tags.find(t => t.id === activeTag)
  const isAll     = activeTag === 'all'

  // Background tint
  sectionEl.style.backgroundColor = tagMeta ? hexToRgba(tagMeta.color, 0.04) : ''

  // Rebuild carousel with filtered images
  const filtered = isAll
    ? allImages
    : allImages.filter(img => img.tags.includes(activeTag))

  currentImages = filtered
  currentLabel  = isAll ? 'All' : activeTag
  buildCarousel(filtered)
  updateSeeAll(filtered.length)
})

// ── See all bar ───────────────────────────────────────────────────────────────
const seeAllBar = document.createElement('div')
seeAllBar.className = 'mj-see-all-bar'
const seeAllBtn = document.createElement('button')
seeAllBtn.className = 'mj-see-all-btn'
seeAllBar.appendChild(seeAllBtn)
sectionEl.appendChild(seeAllBar)

function updateSeeAll(count) {
  seeAllBtn.textContent = `See all ${count} images generated in Shina's Style`
}
updateSeeAll(allImages.length)

// ── Full gallery modal ────────────────────────────────────────────────────────
const modal = document.createElement('div')
modal.className = 'mj-modal'
modal.setAttribute('aria-hidden', 'true')
modal.innerHTML = `
  <div class="mj-modal-header">
    <span class="mj-modal-title" id="mj-modal-title"></span>
    <button class="mj-modal-close" aria-label="Close">✕</button>
  </div>
  <div class="mj-modal-body">
    <div class="mj-modal-grid" id="mj-modal-grid"></div>
  </div>`
document.body.appendChild(modal)

const modalGrid  = modal.querySelector('#mj-modal-grid')
const modalTitle = modal.querySelector('#mj-modal-title')

function populateModal(images, label) {
  modalGrid.innerHTML = ''
  modalTitle.textContent = `${label} · ${images.length} images`
  shuffle(images).forEach(item => {
    const div = document.createElement('div')
    div.className = 'mj-item'
    const img = document.createElement('img')
    img.src      = item.src
    img.alt      = item.prompt || ''
    img.loading  = 'lazy'
    img.decoding = 'async'
    div.appendChild(img)
    div.addEventListener('click', () => openLightbox(item.src, item.prompt))
    modalGrid.appendChild(div)
  })
}

function openModal() {
  populateModal(currentImages, currentLabel)
  modal.setAttribute('aria-hidden', 'false')
  modal.classList.add('open')
  document.body.style.overflow = 'hidden'
}
function closeModal() {
  modal.setAttribute('aria-hidden', 'true')
  modal.classList.remove('open')
  document.body.style.overflow = ''
}

seeAllBtn.addEventListener('click', openModal)
modal.querySelector('.mj-modal-close').addEventListener('click', closeModal)
modal.addEventListener('click', e => { if (e.target === modal) closeModal() })
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal() })

