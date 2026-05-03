/**
 * perena-scroll.js
 * Arrow navigation for horizontal tweet scroll strips.
 */

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

// Run on load; also re-run if the page is soft-navigated back to
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initTweetScrollers()
    initScrollSpy()
  })
} else {
  initTweetScrollers()
  initScrollSpy()
}
