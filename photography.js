/* ─────────────────────────────────────────
   photography.js — Render photo grid from manifest + lightbox
   ───────────────────────────────────────── */

import { initLightbox } from './lightbox.js'

const lightbox  = document.getElementById('photo-lightbox')
const lbImg     = document.getElementById('photo-lb-img')
const lbCaption = document.getElementById('photo-lb-caption')
const lbClose   = document.getElementById('photo-lb-close')

const { open: openLightbox } = initLightbox(lightbox, lbImg, lbCaption, lbClose)

// ── Fetch manifest and render grid ────────────────────────────────────────────
const photos = await fetch('./photography-manifest.json')
  .then(r => r.json())
  .catch(() => [])
const grid   = document.querySelector('.grid')

photos.forEach(photo => {
  const item = document.createElement('div')
  item.className = 'grid-item'
  item.tabIndex = 0
  item.setAttribute('role', 'button')
  item.dataset.caption = photo.caption || ''
  item.setAttribute('aria-label', `Open photograph: ${photo.caption || photo.alt || 'photograph'}`)

  const img = document.createElement('img')
  img.src     = photo.src
  img.alt     = photo.alt || ''
  img.loading = 'lazy'

  item.appendChild(img)
  grid.appendChild(item)

  const open = () => openLightbox(img.src, photo.caption || '', item)
  item.addEventListener('click', open)
  item.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open() }
  })
})
