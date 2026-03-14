import data from './instagram-data.json'

const grid      = document.getElementById('ig-grid')
const updatedEl = document.getElementById('ig-updated')
const lightbox  = document.getElementById('lightbox')
const lbImg     = document.getElementById('lightbox-img')
const lbCaption = document.getElementById('ig-lb-caption')
const lbClose   = document.getElementById('lightbox-close')

// ── Last updated ─────────────────────────────────────────────────────────────
if (updatedEl && data.lastUpdated) {
  const d = new Date(data.lastUpdated)
  updatedEl.textContent = `Updated ${d.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  })}`
}

// ── Empty state ───────────────────────────────────────────────────────────────
if (!data.elements || data.elements.length === 0) {
  grid.innerHTML = `
    <div style="grid-column:1/-1; padding: 60px 32px; text-align:center; opacity:0.4;">
      <p style="font-family:var(--font-display);font-style:italic;font-size:1.2rem;">
        Gallery coming soon.
      </p>
    </div>`
}

// ── Render masonry grid ───────────────────────────────────────────────────────
data.elements.forEach((el, i) => {
  const item = document.createElement('div')
  item.className = 'cosmos-item'
  item.style.animationDelay = `${i * 0.045}s`
  item.style.cursor = 'zoom-in'

  const img = document.createElement('img')
  img.src      = el.src
  img.alt      = el.caption || ''
  img.loading  = i < 6 ? 'eager' : 'lazy'
  img.decoding = 'async'

  item.appendChild(img)
  grid.appendChild(item)

  item.addEventListener('click', () => openLightbox(el.src, el.caption))
})

// ── IntersectionObserver fade-in ─────────────────────────────────────────────
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible')
      observer.unobserve(entry.target)
    }
  })
}, { threshold: 0.05 })

document.querySelectorAll('.cosmos-item').forEach(el => observer.observe(el))

// ── Lightbox ──────────────────────────────────────────────────────────────────
function openLightbox(src, caption) {
  lbImg.src = src
  lbCaption.textContent = caption || ''
  lbCaption.style.display = caption ? '' : 'none'
  lightbox.classList.add('open')
  lightbox.setAttribute('aria-hidden', 'false')
  document.body.style.overflow = 'hidden'
}

function closeLightbox() {
  lightbox.classList.remove('open')
  lightbox.setAttribute('aria-hidden', 'true')
  document.body.style.overflow = ''
  setTimeout(() => { lbImg.src = '' }, 300)
}

lbClose.addEventListener('click', closeLightbox)
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox() })
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox() })
