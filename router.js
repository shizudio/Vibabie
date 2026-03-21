/**
 * router.js
 * Lightweight navigation helper for multi-page site.
 * - Soft navigates between simple subpages (same layout, no complex scripts)
 * - Falls back to hard navigation for complex pages (index, record, cosmos, etc.)
 * - Preserves music playback state via sessionStorage for auto-resume
 */

// Pages safe for soft navigation (no complex page-specific scripts)
const SOFT_NAV_PAGES = ['/about.html']

const SWAPPABLE = ['main', 'nav', 'footer', '.page-header']
const SKIP_SCRIPTS = ['script.js', 'vinyl-widget.js', 'router.js']

let currentPageScripts = []

export function initRouter() {
  document.addEventListener('click', handleClick)
  window.addEventListener('popstate', handlePopState)
  window.__softNavigate = (path) => navigate(path)
}

function handleClick(e) {
  const link = e.target.closest('a[href]')
  if (!link) return

  const url = new URL(link.href, location.origin)

  if (url.origin !== location.origin) return
  if (url.pathname === location.pathname && url.hash) return
  if (link.target === '_blank') return
  if (link.hasAttribute('download')) return
  if (e.ctrlKey || e.metaKey || e.shiftKey) return

  // Index page: skip loader when returning
  if (url.pathname === '/' || url.pathname === '/index.html') {
    sessionStorage.setItem('skip-loader', '1')
    return
  }

  // Hard nav pages: let browser handle it
  if (!SOFT_NAV_PAGES.includes(url.pathname)) return

  // Also hard nav if current page is complex (scripts may have side effects)
  if (!SOFT_NAV_PAGES.includes(location.pathname)) return

  e.preventDefault()
  navigate(url.pathname + url.search + url.hash)
}

function handlePopState() {
  const path = location.pathname + location.search + location.hash
  if (!SOFT_NAV_PAGES.includes(path)) {
    location.reload()
    return
  }
  navigate(path, false)
}

async function navigate(path, pushState = true) {
  // Hard navigate for complex pages
  if (!SOFT_NAV_PAGES.includes(path)) {
    if (path === '/' || path === '/index.html') {
      sessionStorage.setItem('skip-loader', '1')
    }
    location.href = path
    return
  }

  try {
    const resp = await fetch(path)
    if (!resp.ok) {
      location.href = path
      return
    }

    const html = await resp.text()
    const doc = new DOMParser().parseFromString(html, 'text/html')

    // Update title
    document.title = doc.title

    // Hide overlays from index page
    document.querySelectorAll('.loader, .hanging-string, .tooltip')
      .forEach(el => el.style.display = 'none')

    // Swap header
    const newHeader = doc.querySelector('header, .site-header')
    const oldHeader = document.querySelector('header, .site-header')
    if (newHeader && oldHeader) oldHeader.replaceWith(newHeader)

    // Swap main content
    for (const selector of SWAPPABLE) {
      const newEl = doc.querySelector(selector)
      const oldEl = document.querySelector(selector)
      if (newEl && oldEl) {
        oldEl.replaceWith(newEl)
      } else if (newEl && !oldEl) {
        const widget = document.getElementById('vinyl-widget')
        if (widget) document.body.insertBefore(newEl, widget)
        else document.body.appendChild(newEl)
      } else if (!newEl && oldEl) {
        oldEl.remove()
      }
    }

    document.body.className = doc.body.className

    // Swap page-specific stylesheets
    const GLOBAL_CSS = ['style.css', 'vinyl.css', 'record.css']
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      const href = link.getAttribute('href')
      if (!GLOBAL_CSS.some(g => href?.includes(g))) link.remove()
    })
    doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      const href = link.getAttribute('href')
      if (!GLOBAL_CSS.some(g => href?.includes(g))) {
        if (!document.querySelector(`link[href="${href}"]`)) {
          document.head.appendChild(link.cloneNode())
        }
      }
    })

    // Clean up old page scripts
    currentPageScripts.forEach(s => s.remove())
    currentPageScripts = []

    // Execute new page scripts
    const newScripts = Array.from(doc.querySelectorAll('script[type="module"][src]'))
      .filter(s => {
        const name = s.getAttribute('src').split('/').pop()
        return !SKIP_SCRIPTS.includes(name)
      })

    for (const scriptEl of newScripts) {
      const src = scriptEl.getAttribute('src')
      const newScript = document.createElement('script')
      newScript.type = 'module'
      newScript.src = src + (src.includes('?') ? '&' : '?') + '_t=' + Date.now()
      document.body.appendChild(newScript)
      currentPageScripts.push(newScript)
    }

    // Re-attach cursor listeners
    document.querySelectorAll('img').forEach(img => {
      if (typeof window.attachAdaptiveCursor === 'function') {
        window.attachAdaptiveCursor(img)
      }
    })

    window.scrollTo(0, 0)

    if (pushState) history.pushState(null, '', path)

    document.querySelectorAll('.fade-up').forEach(el => el.classList.add('visible'))

  } catch (err) {
    console.warn('Soft navigation failed, falling back:', err)
    location.href = path
  }
}
