/* ─────────────────────────────────────────
   menu.js — Site-wide navigation overlay
   ───────────────────────────────────────── */

const NAV_ITEMS = [
  { label: 'The Bed',              desc: 'Who I Am',            href: 'about.html' },
  { label: 'The Fujifilm Camera',  desc: 'Photography',         href: 'photography.html' },
  { label: 'The Canvas',           desc: 'Art & Illustration',  href: 'art.html' },
  { label: 'The Flower',           desc: 'Motif & Studies',     href: 'flowers.html' },
  { label: 'The Record',           desc: 'Music & Vibes',       href: 'record.html' },
  { label: 'The French Press',     desc: 'Personal Aesthetics', href: 'cosmos.html' },
  { label: 'The Shelf',            desc: 'Essays & Writing',    href: 'https://shinafoo.substack.com/', external: true },
  { label: 'The Lamp',             desc: 'AI & Automation',     href: 'ai.html' },
  { label: 'The Window',           desc: 'Get in Touch',        href: 'contact.html' },
  { label: 'The Phone',            desc: 'Thoughts & Updates',  href: 'https://x.com/shizudio', external: true },
  { label: 'The Laptop',           desc: 'Work & Projects',     href: 'work.html' },
]

let focusBeforeMenu = null

function inject() {
  // Replace .nav-page-name span with a toggle button
  const span = document.querySelector('.nav-page-name')
  if (span) {
    const btn = document.createElement('button')
    btn.className = 'menu-toggle'
    btn.id = 'menu-toggle'
    btn.setAttribute('aria-label', 'Toggle navigation')
    btn.setAttribute('aria-expanded', 'false')

    btn.dataset.label = span.textContent

    // Hairline hamburger icon → signals "opens navigation"; morphs to ✕ when open
    const icon = document.createElement('span')
    icon.className = 'menu-toggle-icon'
    icon.setAttribute('aria-hidden', 'true')
    icon.innerHTML = '<i></i><i></i><i></i>'

    const labelEl = document.createElement('span')
    labelEl.className = 'menu-toggle-label'
    labelEl.textContent = span.textContent

    btn.appendChild(icon)
    btn.appendChild(labelEl)
    span.replaceWith(btn)
  }

  // The overlay is global and survives soft page swaps.
  if (document.getElementById('nav-overlay')) return

  // Inject overlay into body
  const overlay = document.createElement('div')
  overlay.id = 'nav-overlay'
  overlay.className = 'nav-overlay'
  overlay.setAttribute('aria-hidden', 'true')
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-label', 'Navigation')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('inert', '')

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

function openMenu({ focusFirst = false } = {}) {
  const overlay = document.getElementById('nav-overlay')
  const toggle = document.getElementById('menu-toggle')
  if (!overlay) return

  overlay.classList.add('open')
  overlay.setAttribute('aria-hidden', 'false')
  overlay.removeAttribute('inert')
  document.body.classList.add('menu-open')
  focusBeforeMenu = document.activeElement

  if (toggle) {
    toggle.setAttribute('aria-expanded', 'true')
    const label = toggle.querySelector('.menu-toggle-label')
    if (label) label.textContent = 'Close'
  }

  document.body.style.overflow = 'hidden'
  if (focusFirst) {
    requestAnimationFrame(() => overlay.querySelector('.nav-overlay-item')?.focus())
  }
}

function closeMenu() {
  const overlay = document.getElementById('nav-overlay')
  const toggle = document.getElementById('menu-toggle')
  if (!overlay) return

  overlay.classList.remove('open')
  overlay.setAttribute('aria-hidden', 'true')
  overlay.setAttribute('inert', '')
  document.body.classList.remove('menu-open')

  if (toggle) {
    toggle.setAttribute('aria-expanded', 'false')
    const label = toggle.querySelector('.menu-toggle-label')
    if (label) label.textContent = toggle.dataset.label || 'Furnishing My Room'
  }

  document.body.style.overflow = ''
  if (focusBeforeMenu instanceof HTMLElement) focusBeforeMenu.focus()
  focusBeforeMenu = null
}

function isOpen() {
  return document.getElementById('nav-overlay')?.classList.contains('open') ?? false
}

export function initMenu() {
  inject()

  // Router swaps replace the topbar but keep this module alive. Expose a
  // refresh hook so the new page label is upgraded to a menu button too.
  window.__refreshMenu = inject

  // Delegate toggle clicks so a button created after soft navigation works
  // without adding a second listener or reinjecting the overlay.
  document.addEventListener('click', e => {
    if (!e.target.closest('#menu-toggle')) return
    if (isOpen()) closeMenu()
    else openMenu({ focusFirst: e.detail === 0 })
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
    if (e.key === 'Escape' && isOpen()) {
      e.preventDefault()
      closeMenu()
      return
    }

    if (e.key !== 'Tab' || !isOpen()) return
    const focusable = [
      document.getElementById('menu-toggle'),
      ...document.querySelectorAll('#nav-overlay .nav-overlay-item'),
    ].filter(Boolean)
    if (!focusable.length) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  })
}
