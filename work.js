/**
 * work.js — Work catalog: fixed index sidebar + editorial staggered gallery
 * Hover cross-linking between left index and right project images.
 * Click → navigates to project URL.
 */

// ── Load project manifest ─────────────────────────────────
const manifestResp = await fetch('work-manifest.json')
const PROJECTS = await manifestResp.json()

// ── Helpers ───────────────────────────────────────────────
function pad(n) {
  return String(n).padStart(3, '0')
}

// ── DOM refs ──────────────────────────────────────────────
const indexEl   = document.getElementById('catalog-index')
const galleryEl = document.getElementById('catalog-gallery')

// ── Build index + gallery ─────────────────────────────────
const entries = []
const items   = []

PROJECTS.forEach((project, i) => {
  const num = pad(i + 1)

  // ── Left sidebar entry ──────────────────────────────────
  const li = document.createElement('li')
  li.className = 'catalog-entry fade-up'
  li.style.setProperty('--i', i + 3)
  li.dataset.index = i
  li.dataset.workInjected = 'true'
  li.innerHTML = `
    <span class="catalog-num">${num}</span>
    <div class="catalog-entry-info">
      <span class="catalog-title">${project.title}</span>
      <span class="catalog-tag">${project.tag}</span>
    </div>
  `
  indexEl.appendChild(li)
  entries.push(li)

  // ── Right gallery item ──────────────────────────────────
  const isExternal = project.external && project.href !== '#'
  const tag        = isExternal ? 'a' : 'div'

  const div = document.createElement(tag)
  div.className = 'catalog-item fade-up'
  div.style.setProperty('--i', i + 2)
  div.dataset.index = i
  div.dataset.workInjected = 'true'

  if (isExternal) {
    div.href   = project.href
    div.target = '_blank'
    div.rel    = 'noopener noreferrer'
  } else if (project.href && project.href !== '#') {
    div.style.cursor = 'pointer'
  }

  div.innerHTML = `
    <div class="catalog-item-img-wrap">
      <img
        src="${project.src}"
        alt="${project.title}"
        loading="${i === 0 ? 'eager' : 'lazy'}"
      />
    </div>
    <div class="catalog-item-label">
      <span class="catalog-item-num">${num}</span>
      <span class="catalog-item-name">${project.title}</span>
      <span class="catalog-item-year">${project.year}</span>
    </div>
    ${isExternal ? `<span class="catalog-item-ext">${project.href.replace('https://', '')} ↗</span>` : ''}
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

// Index hover + click (click scrolls to image on mobile, navigates on desktop)
entries.forEach((entry, i) => {
  entry.addEventListener('mouseenter', () => activate(i))
  entry.addEventListener('mouseleave', deactivate)

  entry.addEventListener('click', () => {
    if (window.innerWidth <= 767) {
      // Mobile: scroll to corresponding image
      items[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      // Desktop: navigate to project
      const p = PROJECTS[i]
      if (p.href && p.href !== '#') {
        window.open(p.href, p.external ? '_blank' : '_self')
      }
    }
  })
})

// Gallery hover + click
items.forEach((item, i) => {
  item.addEventListener('mouseenter', () => activate(i))
  item.addEventListener('mouseleave', deactivate)

  // For non-<a> items (internal nav), wire up click manually
  if (item.tagName !== 'A') {
    item.addEventListener('click', () => {
      const p = PROJECTS[i]
      if (p.href && p.href !== '#') {
        window.open(p.href, p.external ? '_blank' : '_self')
      }
    })
  }
})

