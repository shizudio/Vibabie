/**
 * perena-scroll.js
 * Arrow navigation for horizontal tweet scroll strips.
 * Also handles hover-to-play video blocks (.case-image--video-hover).
 */

// ── Connection-aware video autoplay ──────────
function isSlowConnection() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  if (!conn) return false
  return conn.saveData || ['slow-2g', '2g'].includes(conn.effectiveType)
}

function initLazyVideos() {
  if (isSlowConnection()) return // Slow connection: leave poster, skip autoplay

  const videos = document.querySelectorAll('video[data-autoplay][preload="none"]')
  if (!videos.length) return

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const vid = entry.target
      if (entry.isIntersecting) {
        vid.preload = 'auto'
        vid.load()
        vid.play().catch(() => {}) // Silently fail if blocked
        observer.unobserve(vid)
      }
    })
  }, { rootMargin: '200px' }) // Start loading 200px before entering viewport

  videos.forEach(v => observer.observe(v))
}

function initBrandStack() {
  const stack   = document.getElementById('brandStack')
  const gallery = document.getElementById('brandGallery')
  const closeBtn = document.getElementById('brandGalleryClose')
  if (!stack || !gallery) return

  const galleryVideos = gallery.querySelectorAll('video')

  function open() {
    gallery.classList.add('is-open')
    gallery.setAttribute('aria-hidden', 'false')
    document.body.style.overflow = 'hidden'
    galleryVideos.forEach(v => {
      if (v.preload === 'none') { v.preload = 'auto'; v.load() }
      v.play().catch(() => {})
    })
  }

  function close() {
    gallery.classList.remove('is-open')
    gallery.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = ''
    galleryVideos.forEach(v => { v.pause(); v.currentTime = 0 })
  }

  stack.addEventListener('click', open)
  stack.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open() })
  closeBtn?.addEventListener('click', e => { e.stopPropagation(); close() })
  gallery.addEventListener('click', e => { if (e.target === gallery) close() })
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close() })
}

function initVideoHovers() {
  document.querySelectorAll('.case-image--video-hover').forEach(block => {
    const vid = block.querySelector('.case-hover-video')
    if (!vid) return
    block.addEventListener('mouseenter', () => { vid.play().catch(() => {}) })
    block.addEventListener('mouseleave', () => { vid.pause(); vid.currentTime = 0 })
  })
}

function initTweetScrollers() {
  document.querySelectorAll('.tweet-scroll-wrap').forEach(wrap => {
    const grid = wrap.querySelector('.tweet-embed-grid')
    const prev = wrap.querySelector('.tweet-scroll-btn--prev')
    const next = wrap.querySelector('.tweet-scroll-btn--next')
    if (!grid || !prev || !next) return

    // Card width (272px) + gap (16px)
    const STEP = 288

    prev.addEventListener('click', () => {
      grid.scrollBy({ left: -STEP, behavior: 'smooth' })
    })

    next.addEventListener('click', () => {
      grid.scrollBy({ left: STEP, behavior: 'smooth' })
    })

    function update() {
      const atStart = grid.scrollLeft <= 2
      const atEnd   = grid.scrollLeft >= grid.scrollWidth - grid.clientWidth - 2
      prev.disabled = atStart
      next.disabled = atEnd
    }

    grid.addEventListener('scroll', update, { passive: true })
    // Re-check after Twitter widgets resize embeds
    setTimeout(update, 2000)
    update()
  })
}

// ── SIDE NAV CLICKS + SCROLL SPY ─────────
function initScrollSpy() {
  const links = document.querySelectorAll('.case-sidenav-item')
  if (!links.length) return

  const sections = Array.from(links).map(l => {
    const id = l.getAttribute('href').replace('#', '')
    return document.getElementById(id)
  }).filter(Boolean)

  // Offset for fixed top nav (~64px) + a little breathing room
  const NAV_OFFSET = 80

  // Click: smooth scroll with offset instead of native anchor jump
  links.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault()
      const id = link.getAttribute('href').replace('#', '')
      const target = document.getElementById(id)
      if (!target) return
      const top = target.getBoundingClientRect().top + window.scrollY - NAV_OFFSET
      window.scrollTo({ top, behavior: 'smooth' })
    })
  })

  // Scroll spy: highlight whichever section is nearest the top
  function onScroll() {
    const threshold = window.scrollY + NAV_OFFSET + 40
    let active = sections[0]
    for (const sec of sections) {
      if (sec.offsetTop <= threshold) active = sec
    }
    links.forEach(l => {
      l.classList.toggle('active', l.getAttribute('href') === '#' + active.id)
    })
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
}

function reloadTwitterWidgets() {
  if (window.twttr && window.twttr.widgets) {
    window.twttr.widgets.load()
  }
}

// Run on load; also re-run if the page is soft-navigated back to
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initTweetScrollers()
    initScrollSpy()
    initVideoHovers()
    initLazyVideos()
    initBrandStack()
    reloadTwitterWidgets()
  })
} else {
  initTweetScrollers()
  initScrollSpy()
  initVideoHovers()
  initLazyVideos()
  initBrandStack()
  reloadTwitterWidgets()
}
