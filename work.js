/**
 * work.js — Work catalog: fixed index sidebar + editorial staggered gallery
 * Hover cross-linking between left index and right project images.
 * Click → navigates to project URL.
 */

// ── Load project manifest ─────────────────────────────────
const manifestResp = await fetch('work-manifest-v2.json')
const PROJECTS = await manifestResp.json()

// ── DOM refs ──────────────────────────────────────────────
const indexEl   = document.getElementById('catalog-index')
const galleryEl = document.getElementById('catalog-gallery')

// ── Build index + gallery ─────────────────────────────────
const entries = []
const items   = []

PROJECTS.forEach((project, i) => {
  // ── Left sidebar entry ──────────────────────────────────
  const li = document.createElement('li')
  li.dataset.i18nSkip = ''
  const entry = document.createElement('a')
  entry.className = 'catalog-entry fade-up'
  entry.style.setProperty('--i', i + 3)
  entry.dataset.index = i
  entry.dataset.workInjected = 'true'
  entry.href = project.href || '#'
  const title = document.createElement('span')
  title.className = 'catalog-title'
  title.textContent = project.title
  entry.appendChild(title)
  li.appendChild(entry)
  indexEl.appendChild(li)
  entries.push(entry)

  // ── Right gallery item ──────────────────────────────────
  const div = document.createElement('a')
  div.className = 'catalog-item fade-up' + (project.comingSoon ? ' catalog-item--coming-soon' : '')
  div.style.setProperty('--i', i + 2)
  div.dataset.index = i
  div.dataset.workInjected = 'true'
  div.dataset.i18nSkip = ''
  div.href = project.href || '#'
  div.setAttribute('aria-label', project.title)

  if (project.external && project.href !== '#') {
    for (const link of [entry, div]) {
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
    }
  }

  // "Coming soon" projects have no screenshot yet — a placeholder card
  // instead of a broken/missing <img>.
  const imgOrPlaceholder = project.comingSoon
    ? `<div class="catalog-item-placeholder"><span>${project.title}</span></div>`
    : `<img
        src="${project.src}"
        alt="${project.title}"
        loading="${i === 0 ? 'eager' : 'lazy'}"
      />`

  div.innerHTML = `
    <div class="catalog-item-img-wrap">
      ${imgOrPlaceholder}
    </div>
  `
  // Mobile has no sidebar index, so each image carries its own project name.
  const caption = document.createElement('span')
  caption.className = 'catalog-item-caption'
  caption.textContent = project.title
  div.appendChild(caption)

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

// Native anchors keep keyboard, modified clicks, and external links working.
// Focus mirrors hover so the same project is clear for keyboard visitors.
for (const links of [entries, items]) {
  links.forEach((link, i) => {
    link.addEventListener('mouseenter', () => activate(i))
    link.addEventListener('mouseleave', deactivate)
    link.addEventListener('focus', () => activate(i))
    link.addEventListener('blur', deactivate)
  })
}
