/* ─────────────────────────────────────────
   menu.js — Site-wide navigation overlay
   ───────────────────────────────────────── */

const NAV_ITEMS = [
  { label: 'The Bed',              desc: 'Who I Am',            href: 'about.html' },
  { label: 'The Fujifilm Camera',  desc: 'Photography',         href: 'photography.html' },
  { label: 'The Canvas',           desc: 'Art & Illustration',  href: 'art.html' },
  { label: 'The Record',           desc: 'Music & Vibes',       href: 'record.html' },
  { label: 'The French Press',     desc: 'Personal Aesthetics', href: 'cosmos.html' },
  { label: 'The Shelf',            desc: 'Essays & Writing',    href: 'https://shinafoo.substack.com/', external: true },
  { label: 'The Light',            desc: 'Get in Touch',        href: 'contact.html' },
  { label: 'The Phone',            desc: 'Thoughts & Updates',  href: 'https://x.com/shizudio', external: true },
  { label: 'The Laptop',           desc: 'Work & Projects',     href: 'work.html' },
]

function inject() {
  // Replace .nav-page-name span with a toggle button
  const span = document.querySelector('.nav-page-name')
  if (span) {
    const btn = document.createElement('button')
    btn.className = 'menu-toggle'
    btn.id = 'menu-toggle'
    btn.setAttribute('aria-label', 'Toggle navigation')
    btn.setAttribute('aria-expanded', 'false')

    const labelEl = document.createElement('span')
    labelEl.className = 'menu-toggle-label'
    labelEl.textContent = span.textContent
    btn.dataset.label = span.textContent
    btn.appendChild(labelEl)
    span.replaceWith(btn)
  }

  // Inject overlay into body
  const overlay = document.createElement('div')
  overlay.id = 'nav-overlay'
  overlay.className = 'nav-overlay'
  overlay.setAttribute('aria-hidden', 'true')
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-label', 'Navigation')

  overlay.innerHTML = `
    <nav class="nav-overlay-nav">
      ${NAV_ITEMS.map((item, i) => `
        <a href="${item.href}"
           class="nav-overlay-item"
           style="--i:${i}"
           ${item.external ? 'target="_blank" rel="noopener noreferrer"' : ''}>
          <span class="nav-overlay-label">${item.label}</span>
          <span class="nav-overlay-desc">${item.desc}</span>
        </a>
      `).join('')}
    </nav>
  `
  document.body.appendChild(overlay)
}

function openMenu() {
  const overlay = document.getElementById('nav-overlay')
  const toggle = document.getElementById('menu-toggle')
  if (!overlay) return

  overlay.classList.add('open')
  overlay.setAttribute('aria-hidden', 'false')
  document.body.classList.add('menu-open')

  if (toggle) {
    toggle.setAttribute('aria-expanded', 'true')
    const label = toggle.querySelector('.menu-toggle-label')
    if (label) label.textContent = 'Close'
  }

  document.body.style.overflow = 'hidden'
}

function closeMenu() {
  const overlay = document.getElementById('nav-overlay')
  const toggle = document.getElementById('menu-toggle')
  if (!overlay) return

  overlay.classList.remove('open')
  overlay.setAttribute('aria-hidden', 'true')
  document.body.classList.remove('menu-open')

  if (toggle) {
    toggle.setAttribute('aria-expanded', 'false')
    const label = toggle.querySelector('.menu-toggle-label')
    if (label) label.textContent = toggle.dataset.label || 'Furnishing My Room'
  }

  document.body.style.overflow = ''
}

function isOpen() {
  return document.getElementById('nav-overlay')?.classList.contains('open') ?? false
}

export function initMenu() {
  inject()

  const toggle = document.getElementById('menu-toggle')
  toggle?.addEventListener('click', () => {
    if (isOpen()) closeMenu()
    else openMenu()
  })

  // Single delegated handler on overlay: nav items + background close
  document.getElementById('nav-overlay')?.addEventListener('click', e => {
    const item = e.target.closest('.nav-overlay-item')
    if (item) {
      const href = item.getAttribute('href')
      const isExternal = item.getAttribute('target') === '_blank'
      closeMenu()
      if (!isExternal && href) {
        e.preventDefault()
        window.location.href = href
      }
      return
    }
    // Click on bare overlay background closes menu
    if (e.target === e.currentTarget) closeMenu()
  })

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen()) closeMenu()
  })
}
