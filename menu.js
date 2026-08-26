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

/**
 * The room-themed overlay is a play.html-only affordance now — every other page
 * uses the flat horizontal topbar. Pages opt in by putting `data-room-menu` on
 * their topbar element, which is markup the router carries along when it swaps
 * the header on a soft navigation (a body-level flag would not: router.js copies
 * `body.className` only). Reading the marker fresh on every inject() therefore
 * gives the right answer both on first load and after a soft swap.
 */
function roomBar() {
  return document.querySelector('[data-room-menu]')
}

function inject() {
  const bar = roomBar()

  // Not a room page: make sure nothing is left over from a previous page.
  if (!bar) {
    document.getElementById('menu-toggle')?.remove()
    document.getElementById('nav-overlay')?.remove()
    document.body.classList.remove('menu-open')
    document.body.style.overflow = ''
    return
  }

  // Build the hamburger straight into the topbar. (There is no .nav-page-name
  // span to upgrade any more — the topbar is real links on every page.)
  if (!document.getElementById('menu-toggle')) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'menu-toggle'
    btn.id = 'menu-toggle'
    btn.setAttribute('aria-label', 'Open the room menu')
    btn.setAttribute('aria-expanded', 'false')
    btn.setAttribute('aria-controls', 'nav-overlay')

    // Hairline hamburger icon → signals "opens navigation"; morphs to ✕ when open
    const icon = document.createElement('span')
    icon.className = 'menu-toggle-icon'
    icon.setAttribute('aria-hidden', 'true')
    icon.innerHTML = '<i></i><i></i><i></i>'

    btn.appendChild(icon)
    bar.appendChild(btn)
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
  // refresh hook so the gate is re-evaluated against the newly swapped markup.
  window.__refreshMenu = inject

  // One delegated handler on the document covers the toggle, the overlay items
  // and the overlay background, so a toggle or overlay built after a soft
  // navigation keeps working without re-binding anything.
  document.addEventListener('click', e => {
    if (e.target.closest('#menu-toggle')) {
      if (isOpen()) closeMenu()
      else openMenu({ focusFirst: e.detail === 0 })
      return
    }

    const overlay = document.getElementById('nav-overlay')
    if (!overlay || !overlay.contains(e.target)) return

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
    if (e.target === overlay) closeMenu()
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
