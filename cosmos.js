import data from './cosmos-data.json'

const grid      = document.getElementById('cosmos-grid')
const titleEl   = document.getElementById('cosmos-title')
const updatedEl = document.getElementById('cosmos-updated')
const lightbox  = document.getElementById('lightbox')
const lbImg     = document.getElementById('lightbox-img')
const lbClose   = document.getElementById('lightbox-close')

// ── Collection title ────────────────────────────────────────────────────────
if (titleEl && data.title) titleEl.textContent = data.title

// ── Last updated ────────────────────────────────────────────────────────────
if (updatedEl && data.lastUpdated) {
  const d = new Date(data.lastUpdated)
  updatedEl.textContent = `Updated ${d.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  })}`
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
