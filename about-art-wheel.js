/**
 * about-art-wheel.js — wheel-to-horizontal lock for the About page art rail.
 *
 * On desktop, once the Artworks section fills the screen, a vertical wheel
 * gesture drives the rail sideways INSTEAD of moving the page, and the page
 * stays locked until the rail reaches its end in the direction of travel.
 * This is a compulsory stop, requested as such: the visitor traverses the
 * paintings before the page continues to the room below.
 *
 * The exits, which matter more here than in a budgeted version:
 *   - Reaching either end of the rail releases the page in that direction.
 *   - Scrolling back up rewinds the rail and releases at 0, so the section can
 *     always be left the way it was entered.
 *   - Keyboard scrolling is never intercepted — only `wheel` is.
 *   - Off entirely under prefers-reduced-motion, so anyone who has asked not to
 *     be moved around gets plain native scrolling.
 *   - Inert while the lightbox is open.
 *
 * Every release path stops calling preventDefault() on the very same event
 * that triggered it, so there is never a frame where the wheel does nothing.
 *
 * Off entirely for coarse pointers, viewports under 1024px, and
 * prefers-reduced-motion — DESIGN.md asks for "zero custom scroll physics" on
 * the mobile layout, and native scrolling is the whole story there.
 *
 * ── Soft-nav ──────────────────────────────────────────────────────────────
 * about.html is in router.js's SOFT_NAV_PAGES: <main> is replaced and every
 * page module is re-imported with a `?_t=` cache-buster on each arrival. A
 * cache-busted import is a NEW module instance, so a plain module-level `let
 * wired = false` resets and would let a window-level listener stack once per
 * visit — and worse, each stale listener would keep a closure over the rail
 * that has since been thrown away. So the entire controller (state AND handler
 * identities) lives on `window` under one key and is created exactly once per
 * document; later module instances only hand it the new rail element. The
 * per-element `dataset.artWheelBound` marker makes a repeat attach to the same
 * rail a no-op, mirroring how about-art.js guards its own lightbox init.
 */

const STATE_KEY = '__shizArtRailWheel'

// ── Tunables ───────────────────────────────────────────────────────────────

// Below this the About page is the single-column mobile layout.
const MIN_WIDTH = 1024

// Engage when 60% of the rail is inside the viewport (or, if the rail is ever
// taller than the viewport, when it covers 60% of the viewport). A contiguous
// 60% band always contains the element's midpoint, so this subsumes the
// "midpoint in view" test while staying meaningful for a ~400px-tall rail in a
// ~900px-tall window — where "60% of the viewport height" alone could never
// be satisfied.
// The lock engages on the SECTION, not the rail, and only once the section is
// essentially filling the port. Gating on the rail (396px inside a 900px
// section) meant 60% of the rail was visible while the section was still two
// thirds off-screen — so the page froze on a half-shown section, which is what
// made the stop feel cranky rather than deliberate.
//
// Paired with `scroll-snap-align: center` on the section (about.css), the page
// settles the artworks into the port first and the rail only then takes over.
const ENGAGE_FRACTION = 0.9

// ── The compulsory preview, and the exit after it ───────────────────────────
// Everyone stops here. Once the Artworks fill the screen the page locks and a
// vertical wheel drives the rail sideways for one viewport of travel — enough
// to see what the rail is and how it moves, roughly two and a half paintings.
// That part is not negotiable and is not affected by how fast you arrived.
//
// What happens AFTER the preview is spent depends on intent, read as speed:
//
//   fast -> you are leaving. The page is released and carries on to the room.
//   slow -> you are looking. The lock holds and the rail runs to its end.
//
// Speed is re-read every tick, so slowing down inside the section keeps the
// rail, and speeding up after the preview lets you out — the decision is never
// made once and frozen.
const VELOCITY_WINDOW_MS = 220

// px per ms, measured over the window above. A deliberate mouse scroll runs
// ~1-2; a trackpad fling peaks well past 6. 3.5 sits in the empty space
// between the two, so ordinary browsing never trips it by accident.
const FAST_VELOCITY = 3.5

// The compulsory preview, as a fraction of the viewport height. One screen of
// horizontal travel: long enough to read as a deliberate moment, short enough
// that a visitor heading elsewhere is not held for long.
const PREVIEW_FRACTION = 1

// A gap this long reads as "the visitor stopped", not as a lull inside one
// gesture. Trackpad momentum ticks arrive every ~16ms and a fling can run well
// past a second. Re-arming mid-fling would re-lock a page the visitor has
// already been released from, so the threshold has to clear a whole fling.
const IDLE_MS = 400

// Momentum tails jitter across zero. Only a delta this size counts as a
// deliberate change of direction.
const DIR_NOISE = 4

// deltaMode 1 (DOM_DELTA_LINE, still used by Firefox on some platforms) needs a
// line height to become pixels. 16px is the site's base.
const LINE_PX = 16

// Sub-pixel slop when asking "is the rail at the end?".
const EPS = 1

// IntersectionObserver needs enough thresholds that the 60% crossing is
// reported promptly as the page scrolls.
const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20)

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v
}

function toPixels(delta, mode) {
  if (mode === 1) return delta * LINE_PX
  if (mode === 2) return delta * (window.innerHeight || 800)
  return delta
}

/**
 * Builds the one controller this document will ever have. Everything closes
 * over `s`, so the handlers registered on the first run stay correct after a
 * soft navigation swaps the rail underneath them.
 */
function createController() {
  const mqFine = window.matchMedia('(hover: hover) and (pointer: fine)')
  const mqWide = window.matchMedia(`(min-width: ${MIN_WIDTH}px)`)
  const mqStill = window.matchMedia('(prefers-reduced-motion: reduce)')

  const s = {
    rail: null,
    lightbox: null,
    enabled: false,
    inView: false,
    // `driving` mirrors the .is-wheel-driven class: scroll-snap and smooth
    // scroll-behaviour are suspended on the rail while it is true.
    driving: false,
    // `released` means this engagement is spent. It stays true until re-arm.
    released: true,
    spent: 0,
    preview: 0,
    samples: [],
    // Cached scroll position and maximum, so the wheel handler does no layout
    // reads of its own. Re-measured on re-arm and on resize, and kept honest by
    // the rail's own scroll event for native scrolls (hand swipe, tab focus).
    pos: 0,
    max: 0,
    lastDir: 0,
    lastTime: 0,
    idleTimer: 0,
  }

  function refreshEnabled() {
    s.enabled = mqFine.matches && mqWide.matches && !mqStill.matches
    if (!s.enabled) setDriving(false)
  }

  function setDriving(on) {
    if (s.driving === on) return
    s.driving = on
    if (s.rail) s.rail.classList.toggle('is-wheel-driven', on)
  }

  // Restore the rail's own physics once the gesture has genuinely stopped —
  // not the instant we release. Releasing mid-fling and re-snapping at the same
  // moment would put a card-settling animation on screen while the page is
  // already moving; waiting for the lull lets the settle read as the end of the
  // gesture, which is exactly what a hand swipe does today.
  function armIdle() {
    clearTimeout(s.idleTimer)
    s.idleTimer = setTimeout(() => {
      // Only hand the rail's own physics back once we have actually let go of
      // it. Restoring `scroll-snap: mandatory` + `scroll-behavior: smooth`
      // while still driving is a real bug: deliberate browsing leaves gaps
      // longer than IDLE_MS between ticks, so snap would re-engage mid-gesture
      // and fling the rail to a distant snap point. Measured: 1440px of input
      // moved the rail the full 4435px.
      if (s.released) setDriving(false)
    }, IDLE_MS)
  }

  // The only place that reads layout. Called on re-arm (idle, direction
  // reversal, leaving the section) and on resize — never per wheel tick.
  // Raw input speed, independent of whether we consumed the delta. Sampled on
  // every tick so the reading is current the moment engagement is decided.
  function pushSample(now, dy) {
    s.samples.push({ t: now, d: Math.abs(dy) })
    const cutoff = now - VELOCITY_WINDOW_MS
    while (s.samples.length && s.samples[0].t < cutoff) s.samples.shift()
  }

  function velocity(now) {
    if (s.samples.length < 2) return 0
    const total = s.samples.reduce((sum, x) => sum + x.d, 0)
    return total / Math.max(1, now - s.samples[0].t)
  }

  function rearm() {
    s.spent = 0
    s.preview = (window.innerHeight || 800) * PREVIEW_FRACTION
    // Geometry FIRST. The end-of-rail test below reads s.max, and on the very
    // first re-arm s.max is still 0 — which made `scrollLeft >= s.max - EPS`
    // read as 0 >= -1, i.e. "already at the end", and left `released` stuck
    // true so the rail never engaged at all.
    if (s.rail && s.rail.isConnected) {
      s.max = Math.max(0, s.rail.scrollWidth - s.rail.clientWidth)
      s.pos = s.rail.scrollLeft
    }

    // Do NOT clear `released` while the rail is already parked at the end the
    // visitor is travelling towards: pausing there would otherwise re-lock the
    // page and the section could never be left.
    //
    // lastDir === 0 means no direction has been established yet (a fresh
    // arrival), and must NOT count as being at an end — the rail sits at 0 on
    // arrival, and the old `else` branch read that as "at the end", which was
    // the second half of the same bug.
    const atEnd =
      s.rail && s.rail.isConnected && s.lastDir !== 0
        ? (s.lastDir > 0 ? s.pos >= s.max - EPS : s.pos <= EPS)
        : false
    if (!atEnd) s.released = false
    // The lightbox lives outside <main>, so it is not swapped by the router and
    // may legitimately be absent on a soft arrival from another page. Keep
    // looking until it turns up rather than caching a null forever.
    if (!s.lightbox) s.lightbox = document.getElementById('art-lightbox')
  }

  function release() {
    s.released = true
    // Let the rail settle onto a card now that the gesture is over. Deferred by
    // IDLE_MS so the settle reads as the end of the gesture rather than an
    // animation competing with the page starting to move.
    armIdle()
  }

  function onWheel(e) {
    const rail = s.rail
    if (!s.enabled || !rail || !rail.isConnected) return

    // lightbox.js pins the body while the overlay is open. Stay out of it.
    if (s.lightbox && s.lightbox.classList.contains('open')) {
      setDriving(false)
      return
    }

    // ctrl+wheel is pinch-zoom on a trackpad; never ours.
    if (e.ctrlKey) return

    const dy = toPixels(e.deltaY, e.deltaMode)
    const dx = toPixels(e.deltaX, e.deltaMode)
    if (!dy) return

    // Horizontal intent — a two-finger sideways swipe, or shift+wheel — belongs
    // to the rail natively, snap and all. Never touched.
    if (Math.abs(dx) > Math.abs(dy)) return

    const overRail = rail.contains(e.target)
    if (!s.inView && !overRail) return

    const now = e.timeStamp || performance.now()
    const dir = dy > 0 ? 1 : -1
    const big = Math.abs(dy) >= DIR_NOISE
    if (now - s.lastTime > IDLE_MS || (big && dir !== s.lastDir)) rearm()
    s.lastTime = now
    if (big) s.lastDir = dir
    pushSample(now, dy)

    // A compulsory stop must not be possible to miss. s.inView is already
    // "the section covers most of the screen", and the section is a full
    // viewport tall, so by the time this passes the visitor is looking at
    // artworks and nothing else. The narrower centring test is gone with the
    // centring test: it existed to pick one tidy moment out of a passing
    // scroll, and there is no passing scroll any more.
    if (!s.released && s.inView) {
      const room = dir > 0 ? s.max - s.pos : s.pos
      if (room > EPS) {
        // 1:1 — the rail travels exactly as far as the page would have.
        const next = clamp(s.pos + dy, 0, s.max)
        s.spent += Math.abs(dy)
        s.pos = next

        setDriving(true)
        rail.scrollLeft = next
        armIdle()
        e.preventDefault()
        // Decide now whether the NEXT tick is still ours, so that when the
        // rail runs out the following event flows through untouched. There is
        // never a frame where the wheel does nothing.
        // The preview is spent by every tick regardless of speed, so the stop
        // is genuinely compulsory. Only once it is used up does intent get a
        // vote: still moving fast means "let me out", anything slower means
        // "I am looking at these", and the lock holds to the end of the rail.
        const previewDone = s.spent >= s.preview
        const railEnd = dir > 0 ? next >= s.max - EPS : next <= EPS
        if (railEnd || (previewDone && velocity(now) >= FAST_VELOCITY)) release()
        return
      }
      // The rail is already at the end in this direction on the very first
      // tick: nothing to run, so let the page have it, this event included.
      release()
    }

    if (!overRail) return

    // The pointer is over the rail and we are done with it. Chrome and Firefox
    // would now redirect this vertical wheel into the rail's horizontal axis on
    // their own — and `overscroll-behavior-x: contain` (about.css) would stop it
    // chaining back out at the end, which is precisely the trap this feature
    // must never become. So forward the gesture to the page explicitly.
    e.preventDefault()
    scrollPageBy(dy)
  }

  // `behavior: 'instant'` is an enum value, so an engine that predates it
  // throws TypeError rather than ignoring it. Probe once, not per tick.
  let instantOk = true
  try {
    window.scrollBy({ top: 0, left: 0, behavior: 'instant' })
  } catch (err) {
    instantOk = false
  }

  function scrollPageBy(dy) {
    if (instantOk) window.scrollBy({ top: dy, left: 0, behavior: 'instant' })
    else window.scrollBy(0, dy)
  }

  function onRailScroll() {
    // Native scrolls we did not cause: a hand swipe, or the browser scrolling a
    // focused off-screen card into view when the visitor tabs to it. Adopt the
    // result instead of overwriting it on the next tick.
    if (!s.driving && s.rail) s.pos = s.rail.scrollLeft
  }

  const io = new IntersectionObserver(entries => {
    const entry = entries[entries.length - 1]
    const vh = window.innerHeight || 1
    const need = Math.min(entry.boundingClientRect.height, vh) * ENGAGE_FRACTION
    const nowIn = entry.isIntersecting && entry.intersectionRect.height >= need
    if (nowIn === s.inView) return
    s.inView = nowIn
    if (!nowIn) {
      setDriving(false)
      rearm()
    }
  }, { threshold: THRESHOLDS })

  let resizeTimer = 0
  function onResize() {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      refreshEnabled()
      // IntersectionObserver does not always re-report on a resize alone, and
      // the rail's scrollWidth moves as lazy images land. One measurement, well
      // away from the wheel handler.
      if (s.rail && s.rail.isConnected) {
        const gauge = s.rail.closest('.about-art') || s.rail
        const r = gauge.getBoundingClientRect()
        const vh = window.innerHeight || 1
        const visible = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0))
        s.inView = visible >= Math.min(r.height, vh) * ENGAGE_FRACTION
      }
      rearm()
    }, 120)
  }

  refreshEnabled()
  window.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('resize', onResize)
  ;[mqFine, mqWide, mqStill].forEach(mq => {
    if (mq.addEventListener) mq.addEventListener('change', refreshEnabled)
  })

  function detach(rail) {
    if (!rail) return
    io.unobserve(rail)
    rail.removeEventListener('scroll', onRailScroll)
    rail.classList.remove('is-wheel-driven')
    delete rail.dataset.artWheelBound
  }

  return {
    attach(rail) {
      if (!rail) return
      if (s.rail !== rail) {
        detach(s.rail)
        clearTimeout(s.idleTimer)
        s.rail = rail
        s.driving = false
        s.inView = false
        rail.dataset.artWheelBound = '1'
        rail.addEventListener('scroll', onRailScroll, { passive: true })
        io.observe(rail.closest('.about-art') || rail)
      }
      s.lightbox = document.getElementById('art-lightbox')
      rearm()
    },
  }
}

// Module-level fast path. It is NOT the real guard — see the soft-nav note at
// the top; the window key is what actually survives a cache-busted re-import.
let controller = null

export function initArtRailWheel(rail) {
  if (!rail) return
  if (!controller) {
    controller = window[STATE_KEY] || (window[STATE_KEY] = createController())
  }
  controller.attach(rail)
}
