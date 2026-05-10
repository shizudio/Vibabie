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

  // ── Hover expand inside gallery ──────────
  const galleryGrid = gallery.querySelector('.brand-gallery-grid')
  const galleryItems = gallery.querySelectorAll('.brand-gallery-item')

  galleryItems.forEach(item => {
    item.addEventListener('mouseenter', () => {
      if (!gallery.classList.contains('is-open')) return

      const gridRect = galleryGrid.getBoundingClientRect()
      const itemRect = item.getBoundingClientRect()
      const isWide   = item.classList.contains('brand-gallery-item--wide')
      const isLeft   = (itemRect.left + itemRect.width  / 2) < (gridRect.left + gridRect.width  / 2)
      const isTop    = (itemRect.top  + itemRect.height / 2) < (gridRect.top  + gridRect.height / 2)

      // Column: give more space to whichever side the item is on
      if (!isWide) {
        galleryGrid.classList.toggle('expand-left',  isLeft)
        galleryGrid.classList.toggle('expand-right', !isLeft)
      }

      // Row: expand the row the item sits in, compress the others
      if (isWide) {
        galleryGrid.classList.add('expand-row-wide')
      } else if (isTop) {
        galleryGrid.classList.add('expand-row-top')
      } else {
        galleryGrid.classList.add('expand-row-bottom')
      }

      item.classList.add('is-expanded')
      galleryGrid.classList.add('has-hover')
    })

    item.addEventListener('mouseleave', () => {
      item.classList.remove('is-expanded')
      galleryGrid.classList.remove(
        'has-hover', 'expand-left', 'expand-right',
        'expand-row-top', 'expand-row-bottom', 'expand-row-wide'
      )
    })
  })

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

    // Card width (272px × 0.8 zoom = 218px) + gap (24px)
    const STEP = 242

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

// ── ACCORDION (smooth <details> expand/collapse) ──
function openAccordion(details) {
  if (details.open) return
  const body = details.querySelector('.case-accordion-body')
  if (!body) return
  details.setAttribute('open', '')
  body.style.maxHeight = '0'
  // Let the browser paint the open state before animating
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      body.style.maxHeight = body.scrollHeight + 'px'
      body.addEventListener('transitionend', () => {
        if (details.open) body.style.maxHeight = 'none'
      }, { once: true })
    })
  })
}

function closeAccordion(details) {
  if (!details.open) return
  const body = details.querySelector('.case-accordion-body')
  if (!body) return
  // Snap to current height so transition has a defined start point
  body.style.maxHeight = body.scrollHeight + 'px'
  requestAnimationFrame(() => {
    body.style.maxHeight = '0'
    body.addEventListener('transitionend', () => {
      details.removeAttribute('open')
    }, { once: true })
  })
}

function initAccordions() {
  document.querySelectorAll('details.case-accordion').forEach(details => {
    const summary = details.querySelector('.case-accordion-summary')
    if (!summary) return

    summary.addEventListener('click', e => {
      e.preventDefault()
      if (details.open) {
        closeAccordion(details)
      } else {
        openAccordion(details)
      }
    })

    // Collapse button at the foot of each section
    const collapseBtn = details.querySelector('.case-accordion-collapse')
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        closeAccordion(details)
        // After animation starts, scroll back up to the summary trigger
        setTimeout(() => {
          const top = details.getBoundingClientRect().top + window.scrollY - 80
          window.scrollTo({ top, behavior: 'smooth' })
        }, 80)
      })
    }
  })
}

// ── SIDE NAV CLICKS + SCROLL SPY ─────────
function initScrollSpy() {
  const links = document.querySelectorAll('.case-sidenav-item')
  if (!links.length) return

  const targets = Array.from(links).map(l => {
    const id = l.getAttribute('href').replace('#', '')
    return document.getElementById(id)
  }).filter(Boolean)

  // Offset for fixed top nav (~64px) + a little breathing room
  const NAV_OFFSET = 80

  // Click: open accordion if needed, then smooth scroll
  links.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault()
      const id = link.getAttribute('href').replace('#', '')
      const target = document.getElementById(id)
      if (!target) return

      const scrollToTarget = () => {
        const top = target.getBoundingClientRect().top + window.scrollY - NAV_OFFSET
        window.scrollTo({ top, behavior: 'smooth' })
      }

      // If target is a closed accordion, open it first then scroll
      if (target.tagName === 'DETAILS' && !target.open) {
        openAccordion(target)
        // Wait for animation to start before scrolling
        setTimeout(scrollToTarget, 80)
      } else {
        scrollToTarget()
      }
    })
  })

  // Scroll spy: highlight whichever section is nearest the top
  function onScroll() {
    const threshold = window.scrollY + NAV_OFFSET + 40
    let active = targets[0]
    for (const sec of targets) {
      if (sec && sec.offsetTop <= threshold) active = sec
    }
    links.forEach(l => {
      l.classList.toggle('active', active && l.getAttribute('href') === '#' + active.id)
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
    initAccordions()
    initTweetScrollers()
    initScrollSpy()
    initVideoHovers()
    initLazyVideos()
    initBrandStack()
    reloadTwitterWidgets()
  })
} else {
  initAccordions()
  initTweetScrollers()
  initScrollSpy()
  initVideoHovers()
  initLazyVideos()
  initBrandStack()
  reloadTwitterWidgets()
}
