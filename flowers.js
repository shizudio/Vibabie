/* ─────────────────────────────────────────
   flowers.js — Lightbox for The Flower Room
   ───────────────────────────────────────── */

import { initLightbox } from './lightbox.js'

const lightbox = document.getElementById('flower-lightbox')
const lbImg = document.getElementById('flower-lb-img')
const lbCaption = document.getElementById('flower-lb-caption')
const lbClose = document.getElementById('flower-lb-close')

const { open: openLightbox } = initLightbox(lightbox, lbImg, lbCaption, lbClose)

document.querySelectorAll('.flower-frame').forEach(frame => {
  const img = frame.querySelector('img')
  if (!img) return

  frame.addEventListener('click', () => {
    openLightbox(img.currentSrc || img.src, frame.dataset.caption || img.alt || '')
  })
})
