/**
 * about-peek.js — rotates the silk design behind the landing page's peek band.
 *
 * The band itself is pure CSS (see .peek-band in about.css): a still layer
 * painted behind the page, uncovered when the visitor pulls past the top and
 * covered again as the page bounces home. This module does NOT touch that —
 * no motion, no scroll position, no timing. Every earlier version that moved
 * the band on its own clock lagged the bounce; the compositor owns the
 * animation now and must keep owning it.
 *
 * All this does is decide WHICH design is behind the page, so that each pull
 * brings up a different one.
 *
 * The swap happens while the band is covered — once the visitor has scrolled
 * clear of the top — so the change is never visible as a flicker. The next
 * design is warmed in the browser cache at the same time, so its first reveal
 * is never a blank band.
 *
 * Soft-nav safe: about.html is in router.js's SOFT_NAV_PAGES, so <main> is
 * swapped and page modules re-execute cache-busted on every arrival. The
 * controller therefore lives once per document on window; later runs only
 * re-attach the new band element.
 */

const DESIGNS = [
  '/About/silk-01.webp',
  '/About/silk-02.webp',
  '/About/silk-03.webp',
  '/About/silk-04.webp',
  '/About/silk-05.webp',
  '/About/silk-06.webp',
  '/About/silk-07.webp',
]

// Scrolled past this, the band is comfortably covered and safe to swap.
const CLEAR_OF_TOP = 160

// Remembering the index across loads means a revisit continues the rotation
// instead of restarting on the same design every time.
const KEY = 'shiz-peek-i'

function readIndex() {
  try {
    const v = parseInt(sessionStorage.getItem(KEY), 10)
    if (Number.isInteger(v)) return ((v % DESIGNS.length) + DESIGNS.length) % DESIGNS.length
  } catch (e) {
    // Private windows and blocked storage throw on access — fall through.
  }
  // No stored position: start somewhere arbitrary so two visitors, or two
  // sessions, do not both open on silk-01.
  return Math.floor(Math.random() * DESIGNS.length)
}

function writeIndex(i) {
  try { sessionStorage.setItem(KEY, String(i)) } catch (e) { /* non-fatal */ }
}

function controller() {
  const s = { band: null, i: readIndex(), armed: false }

  function show(i) {
    if (!s.band) return
    s.band.style.backgroundImage = `url('${DESIGNS[i]}')`
    writeIndex(i)
    // Warm the next one so its first reveal is never an empty band.
    const next = new Image()
    next.src = DESIGNS[(i + 1) % DESIGNS.length]
  }

  // Advance only on the way back UP to the top, and only once per trip away:
  // the visitor leaves the top (armed), returns, and finds a new design
  // waiting. Swapping on the way down would work too, but arming this way
  // means the design cannot change twice within a single visit to the top.
  function onScroll() {
    const y = window.scrollY || document.documentElement.scrollTop || 0
    if (y > CLEAR_OF_TOP) {
      s.armed = true
      return
    }
    if (s.armed && y <= CLEAR_OF_TOP) {
      s.armed = false
      s.i = (s.i + 1) % DESIGNS.length
      show(s.i)
    }
  }

  // Passive: this module can never block or redirect a scroll.
  window.addEventListener('scroll', onScroll, { passive: true })

  return {
    attach(band) {
      s.band = band
      band.dataset.peekBound = '1'
      show(s.i)
    },
  }
}

export function initPeekBand(band) {
  if (!band) return
  if (!window.__shizPeekBand) window.__shizPeekBand = controller()
  if (band.dataset.peekBound) return
  window.__shizPeekBand.attach(band)
}

const el = document.getElementById('peekBand')
if (el) initPeekBand(el)
