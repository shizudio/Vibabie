/* ─────────────────────────────────────────
   photography.js — Lightbox with captions
   ───────────────────────────────────────── */

const lightbox  = document.getElementById('photo-lightbox')
const lbImg     = document.getElementById('photo-lb-img')
const lbCaption = document.getElementById('photo-lb-caption')
const lbClose   = document.getElementById('photo-lb-close')

function openLightbox(src, caption) {
  lbImg.src         = src
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

document.querySelectorAll('.grid-item').forEach(item => {
  item.addEventListener('click', () => {
    const img     = item.querySelector('img')
    const caption = item.dataset.caption || ''
    openLightbox(img.src, caption)
  })
})

lbClose.addEventListener('click', closeLightbox)
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox() })
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox() })
