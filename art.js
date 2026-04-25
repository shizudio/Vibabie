/**
 * art.js — Art catalog: fixed index sidebar + editorial staggered gallery
 * Hover cross-linking between left index and right images.
 * Click → lightbox.
 */

import { initLightbox } from './lightbox.js'

// ── Load artwork manifest ─────────────────────────────────
const manifestResp = await fetch('art-manifest.json')
const ARTWORKS = await manifestResp.json()

// ── Helpers ───────────────────────────────────────────────
function pad(n) {
  return String(n).padStart(3, '0')
}

function parseYear(meta) {
  const match = meta.match(/\b(20\d{2}|19\d{2})\b/)
  return match ? match[1] : ''
}

// ── DOM refs ──────────────────────────────────────────────
const indexEl   = document.getElementById('catalog-index')
const galleryEl = document.getElementById('catalog-gallery')
const lightbox  = document.getElementById('art-lightbox')
const lbImg     = document.getElementById('art-lb-img')
const lbCaption = document.getElementById('art-lb-caption')
const lbClose   = document.getElementById('art-lb-close')

// ── Lightbox ──────────────────────────────────────────────
const { open: openLightbox } = initLightbox(lightbox, lbImg, lbCaption, lbClose)

// ── Build index + gallery ─────────────────────────────────
const entries = []
const items   = []

ARTWORKS.forEach((art, i) => {
  const num  = pad(i + 1)
  const year = parseYear(art.meta)

  // Left sidebar entry
  const li = document.createElement('li')
  li.className = 'catalog-entry fade-up'
  li.style.setProperty('--i', i + 3) // offset so it staggers after header
  li.dataset.index = i
  li.innerHTML = `
    <span class="catalog-num">${num}</span>
    <span class="catalog-title">${art.title}</span>
    <span class="catalog-year">${year}</span>
  `
  indexEl.appendChild(li)
  entries.push(li)

  // Right gallery item
  const div = document.createElement('div')
  div.className = 'catalog-item fade-up'
  div.style.setProperty('--i', i + 2)
  div.dataset.index = i
  div.innerHTML = `
    <img
      src="${art.src}"
      alt="${art.title}"
      loading="${i < 2 ? 'eager' : 'lazy'}"
    />
    <div class="catalog-item-label">
      <span class="catalog-item-num">${num}</span>
      <span class="catalog-item-title">${art.title}</span>
    </div>
  `
  galleryEl.appendChild(div)
  items.push(div)
})

// ── Cross-link hover state ────────────────────────────────
function activate(i) {
  galleryEl.classList.add('has-hover')
  entries.forEach((e, j) => e.classList.toggle('is-active', j === i))
  items.forEach((it, j)  => it.classList.toggle('is-active', j === i))
}

function deactivate() {
  galleryEl.classList.remove('has-hover')
  entries.forEach(e  => e.classList.remove('is-active'))
  items.forEach(it   => it.classList.remove('is-active'))
}

// Left index interactions
entries.forEach((entry, i) => {
  entry.addEventListener('mouseenter', () => activate(i))
  entry.addEventListener('mouseleave', deactivate)
  entry.addEventListener('click', () => {
    const art = ARTWORKS[i]
    openLightbox(art.src, art.description || art.title)
  })
})

// Right gallery interactions
items.forEach((item, i) => {
  item.addEventListener('mouseenter', () => activate(i))
  item.addEventListener('mouseleave', deactivate)
  item.addEventListener('click', () => {
    const art = ARTWORKS[i]
    openLightbox(art.src, art.description || art.title)
  })
})

// ── Keyboard navigation (scroll through lightbox) ─────────
let currentIndex = -1

document.addEventListener('keydown', e => {
  if (!lightbox.classList.contains('open')) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    currentIndex = Math.min(currentIndex + 1, ARTWORKS.length - 1)
    const art = ARTWORKS[currentIndex]
    openLightbox(art.src, art.description || art.title)
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    currentIndex = Math.max(currentIndex - 1, 0)
    const art = ARTWORKS[currentIndex]
    openLightbox(art.src, art.description || art.title)
  }
})

items.forEach((item, i) => {
  item.addEventListener('click', () => { currentIndex = i })
})
entries.forEach((entry, i) => {
  entry.addEventListener('click', () => { currentIndex = i })
})

// ── Touch: swipe on mobile gallery to scroll (native) ─────
// Nothing needed — native scroll handles it on mobile.

// ── Mobile number nav — tap to scroll to image ────────────
if (window.innerWidth <= 767) {
  entries.forEach((entry, i) => {
    entry.addEventListener('click', () => {
      items[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  })
}
