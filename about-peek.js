/**
 * about-peek.js — pull-to-reveal silk band at the top of the landing page.
 *
 * Pull up at the very top of the page and a band of the silk floral slides
 * down from under the topbar; stop pulling and it springs back.
 *
 * Why this is JS at all: three CSS-only versions failed first, each relying on
 * the browser painting something in the rubber-band region (the canvas
 * background above y=0, an element positioned above the document, a
 * viewport-fixed background). Whether any of those paint during the spring is
 * a compositor detail that varies by browser and cannot be observed from a
 * headless test, so each attempt was a guess that had to be checked by hand.
 * Owning the motion makes it behave identically everywhere and, just as
 * importantly, makes it verifiable.
 *
 * What it deliberately does NOT do — the lesson from the art rail:
 *   - never calls preventDefault. At scrollTop 0 an upward wheel already
 *     scrolls nothing, so reading it takes nothing away from the visitor.
 *   - never writes window.scrollTo, so it cannot fight native momentum.
 *   - the listener is passive, so it can never block a scroll.
 * The browser's own bounce still happens underneath and simply adds to this.
 *
 * Soft-nav safe: about.html is in router.js's SOFT_NAV_PAGES, so <main> is
 * swapped and page modules re-execute cache-busted on every arrival. The
 * controller therefore lives once per document on window and later runs only
 * re-attach the new band element.
 */

// How much of the pull translates into travel. Below 1 so the band trails the
// gesture slightly, which is what makes it feel elastic rather than pinned.
const PULL_RATIO = 0.5

// Never reveal more than the band's own height — past that it would detach
// from the topbar and read as a floating stripe.
const MAX_REVEAL = 1

// How near the top counts as "at the top". This is NOT zero, and that is the
// whole reason three earlier attempts showed nothing: `.about-intro` carries
// `scroll-snap-align: start` and `main` has 58px of top padding, so the top
// snap position is 58 and scrollTop 0 is unreachable — scrollTo(0, 0) springs
// straight back to 58. The "spring" at the top of this page is that snap
// recoiling, not a rubber band. Anything gated on scrollTop === 0 could never
// fire. A hair over the snap point arms the pull as the visitor arrives at
// the top, which is exactly when the gap opens.
const TOP_ZONE = 64

// Quiet for this long and the band springs home. Trackpad momentum ticks
// arrive ~16ms apart and a fling runs well past a second, so anything much
// shorter would retract mid-gesture.
const IDLE_MS = 220

function controller() {
  const s = { band: null, pull: 0, height: 0, navH: 58, idleTimer: 0, raf: 0, springing: false }

  function measure() {
    if (s.band) s.height = s.band.getBoundingClientRect().height || 60
    // The band slides out from under the topbar, so the reveal starts at the
    // bar's lower edge — measured, since it is 58px on desktop and 54 on mobile.
    const nav = document.querySelector('nav')
    s.navH = nav ? Math.round(nav.getBoundingClientRect().height) : 58
  }

  function paint() {
    s.raf = 0
    if (!s.band) return
    const shown = Math.min(s.pull, s.height * MAX_REVEAL)
    // At rest: bottom edge at y=0, fully above the viewport. Open: bottom edge
    // at navH + shown, so exactly `shown` px peek out below the topbar. The
    // band exists only while something is showing — visibility, not just
    // position, so it can never be left standing when the bar auto-hides.
    if (shown > 0.5) {
      s.band.classList.add('is-open')
      s.band.style.transform = `translate3d(0, calc(-100% + ${s.navH + shown}px), 0)`
    } else {
      s.band.style.transform = 'translate3d(0, -100%, 0)'
      s.band.classList.remove('is-open')
    }
  }

  function schedulePaint() {
    if (!s.raf) s.raf = requestAnimationFrame(paint)
  }

  // Ease the band home rather than snapping it, so releasing reads as the
  // other half of the same gesture.
  function spring() {
    if (s.springing) return
    s.springing = true
    const from = s.pull
    const t0 = performance.now()
    const DUR = 420
    const ease = t => 1 - Math.pow(1 - t, 3)
    const step = now => {
      const t = Math.min(1, (now - t0) / DUR)
      s.pull = from * (1 - ease(t))
      paint()
      if (t < 1) requestAnimationFrame(step)
      else { s.pull = 0; s.springing = false; paint() }
    }
    requestAnimationFrame(step)
  }

  function armIdle() {
    clearTimeout(s.idleTimer)
    s.idleTimer = setTimeout(spring, IDLE_MS)
  }

  function onWheel(e) {
    const band = s.band
    if (!band || !band.isConnected) return

    // Only near the top, and only pulling upward.
    const y = window.scrollY || document.documentElement.scrollTop || 0
    if (y > TOP_ZONE) {
      if (s.pull > 0) spring()
      return
    }
    if (e.deltaY >= 0) {
      // Pushing back down: let it go home immediately rather than waiting out
      // the idle timer, or the band would hang while the page starts moving.
      if (s.pull > 0) { clearTimeout(s.idleTimer); spring() }
      return
    }

    if (s.springing) s.springing = false
    if (!s.height) measure()

    // deltaMode 1 (Firefox line mode) needs a line height to become pixels.
    const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
    s.pull = Math.min(s.height * MAX_REVEAL, s.pull + -px * PULL_RATIO)
    schedulePaint()
    armIdle()
  }

  function onScroll() {
    if ((window.scrollY || 0) > TOP_ZONE && s.pull > 0) spring()
  }

  let resizeTimer = 0
  function onResize() {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(measure, 150)
  }

  // Everything passive. Nothing here can block or redirect a scroll.
  window.addEventListener('wheel', onWheel, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize)
  window.addEventListener('blur', () => { if (s.pull > 0) spring() })

  return {
    attach(band) {
      s.band = band
      s.pull = 0
      s.springing = false
      band.dataset.peekBound = '1'
      measure()
      // Images and fonts may still be settling; re-measure shortly after.
      setTimeout(measure, 400)
      paint()
    },
    _state: s,
  }
}

export function initPeekBand(band) {
  if (!band) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (!window.__shizPeekBand) window.__shizPeekBand = controller()
  if (band.dataset.peekBound) return
  window.__shizPeekBand.attach(band)
}

const el = document.getElementById('peekBand')
if (el) initPeekBand(el)
