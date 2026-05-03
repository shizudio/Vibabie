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

// ── SIDE NAV SCROLL SPY ───────────────────
function initScrollSpy() {
  const links = document.querySelectorAll('.case-sidenav-item')
  if (!links.length) return

  const sections = Array.from(links).map(l => {
    const id = l.getAttribute('href').replace('#', '')
    return document.getElementById(id)
  }).filter(Boolean)

  function onScroll() {
    const mid = window.scrollY + window.innerHeight * 0.4
    let active = sections[0]
    for (const sec of sections) {
      if (sec.offsetTop <= mid) active = sec
    }
    links.forEach(l => {
      const match = l.getAttribute('href') === '#' + active.id
      l.classList.toggle('active', match)
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
