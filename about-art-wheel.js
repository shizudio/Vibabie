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

// ── The capture ─────────────────────────────────────────────────────────────
// A hard stop has to take the page BEFORE the visitor is past the section,
// otherwise it is not a stop, it is a suggestion. CSS scroll-snap could not do
// this: `proximity` is lenient by design (you can always out-scroll it) and
// `mandatory` would fight the wheel interception for control of the same
// scroll position — that fight was the jank on entry.
//
// So the capture is ours, and it fires the instant the section's leading edge
// crosses into the port.
//
// This used to be 0.9, which sounds early but was not: the section enters at
// top = vh and 0.9 fires at top = 0.9*vh, so the window to notice was only a
// tenth of a screen — 72px on a 720px window. Any scroll step bigger than that
// stepped straight over the trigger, which is exactly how the section could
// still be passed. At 1 the window is the whole approach and nothing can jump
// it.
const CAPTURE_FRACTION = 1

// How far the page may be pulled BACK to reach the port, as a fraction of the
// viewport. Reversing is normally forbidden — it reads as a glitch — but a
// compulsory stop that a fast burst can overshoot is not compulsory. Small
// corrections settle; large ones would yank, so past this the section is let
// go rather than dragged back.
const MAX_PULLBACK_FRACTION = 0.5

// Long enough to read as the page deliberately settling rather than snapping.
// 420 was too brisk to register as an arrival — it looked like a correction.
const PARK_MS = 760


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

// The compulsory preview is measured from the RAIL, not the viewport: it lasts
// until the first painting has travelled fully off the left edge of the screen.
// That is a real landmark the visitor can see arriving, so the stop ends on
// something legible rather than on an arbitrary number of pixels. A viewport
// fraction happened to be close on one window size and wrong on every other.
//
// Falls back to one viewport if the rail has no cards to measure.
const PREVIEW_FALLBACK_FRACTION = 1

// How far the rail must travel for the first card's trailing edge to clear the
// left edge of the port: its own offset (the rail's leading inset), its width,
// and the gap that follows it — so the second card lands flush at the edge.
function previewDistance(rail) {
  const first = rail && rail.children[0]
  if (!first) return (window.innerHeight || 800) * PREVIEW_FALLBACK_FRACTION
  const cs = getComputedStyle(rail)
  const gap = parseFloat(cs.columnGap || cs.gap) || 0
  return first.offsetLeft + first.offsetWidth + gap
}

// A gap this long reads as "the visitor stopped", not as a lull inside one
// gesture. Trackpad momentum ticks arrive every ~16ms and a fling can run well
// past a second. Re-arming mid-fling would re-lock a page the visitor has
// already been released from, so the threshold has to clear a whole fling.
const IDLE_MS = 400

// Momentum tails jitter across zero. Only a delta this size counts as a
// deliberate change of direction.
const DIR_NOISE = 4
const big = dy => Math.abs(dy) >= DIR_NOISE

// deltaMode 1 (DOM_DELTA_LINE, still used by Firefox on some platforms) needs a
// line height to become pixels. 16px is the site's base.
const LINE_PX = 16

// ── Hover-to-scroll ─────────────────────────────────────────────────────────
// Resting the pointer in either half of the port keeps the rail moving — right
// to go forward, left to come back —
// so browsing the paintings does not require continuous scrolling. Speed ramps
// from nothing at the zone's inner boundary to HOVER_MAX_SPEED at the screen
// edge, so it eases in as you approach rather than snapping to a fixed rate —
// a constant speed makes the boundary feel like a switch.
const HOVER_ZONE = 0.5

// A neutral strip either side of the midline where the rail does not move, as
// a fraction of the viewport width (total, so half of it sits on each side).
// Without it the only place the pointer can rest without the rail drifting is
// the midline itself, which makes it impossible to simply stop and look at a
// painting. The ramps still start from zero at the band's edges, so crossing
// out of it stays continuous rather than snapping to a speed.
const HOVER_DEAD_BAND = 0.12

// px per ms at the very edge. ~1.0 is a readable browse: a 273px card passes
// in a little over a quarter of a second at full tilt, slower everywhere else.
const HOVER_MAX_SPEED = 1.0

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
    parking: false,
    parkedOnce: false,
    parkRAF: 0,
    hoverX: -1,
    hoverRAF: 0,
    hoverLast: 0,
    lastScrollY: 0,
    arrivalGesture: false,
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

  // ── Hover-to-scroll ───────────────────────────────────────────────────────
  // Signed: positive drives the rail forward, negative back. The midline is
  // the boundary for both, so the two halves meet with no dead strip between
  // them and no overlap.
  //
  // The left half stays inert until there is actually rail behind the visitor
  // to return to. Before that it would be a live zone that does nothing, which
  // reads as broken rather than as unavailable.
  function hoverSpeed() {
    if (s.hoverX < 0) return 0
    const vw = window.innerWidth || 1
    const mid = vw * (1 - HOVER_ZONE)
    const half = (vw * HOVER_DEAD_BAND) / 2
    const goStart = mid + half
    const backStart = mid - half

    if (s.hoverX >= goStart) {
      const t = Math.min(1, (s.hoverX - goStart) / Math.max(1, vw - goStart))
      return t * HOVER_MAX_SPEED
    }

    if (s.hoverX <= backStart) {
      // Inert until there is rail behind the visitor to return to — a live
      // zone that does nothing reads as broken rather than as unavailable.
      const rail = s.rail
      if (!rail || rail.scrollLeft <= EPS) return 0
      const t = Math.min(1, (backStart - s.hoverX) / Math.max(1, backStart))
      return -t * HOVER_MAX_SPEED
    }

    // The dead band: somewhere to put the cursor and just look.
    return 0
  }

  function hoverStop() {
    cancelAnimationFrame(s.hoverRAF)
    s.hoverRAF = 0
    s.hoverLast = 0
    // Hand the rail's physics back only if no wheel gesture is mid-flight.
    if (!s.driving) return
    armIdle()
  }

  function hoverTick(now) {
    const rail = s.rail
    if (!rail || !rail.isConnected || !s.enabled || !s.inView || s.parking) {
      hoverStop()
      return
    }
    if (s.lightbox && s.lightbox.classList.contains('open')) { hoverStop(); return }

    const speed = hoverSpeed()
    if (speed === 0) { hoverStop(); return }

    const dt = s.hoverLast ? Math.min(64, now - s.hoverLast) : 16
    s.hoverLast = now

    const max = Math.max(0, rail.scrollWidth - rail.clientWidth)
    // Stop at whichever end this direction is heading for.
    if (speed > 0 ? rail.scrollLeft >= max - EPS : rail.scrollLeft <= EPS) {
      hoverStop()
      return
    }

    // Same suppression the wheel path uses: mandatory snap would fight every
    // frame of this and turn a glide into a stutter.
    setDriving(true)
    const next = Math.max(0, Math.min(max, rail.scrollLeft + speed * dt))
    rail.scrollLeft = next
    s.pos = next

    s.hoverRAF = requestAnimationFrame(hoverTick)
  }

  function hoverStart() {
    if (s.hoverRAF) return
    s.hoverLast = 0
    s.hoverRAF = requestAnimationFrame(hoverTick)
  }

  function onPointerMove(e) {
    if (!s.enabled) return
    s.hoverX = e.clientX
    maybeHover()
  }

  // Hover-to-scroll must not depend on the pointer having moved. Scrolling back
  // into the section with the mouse held still left the glide dead, because
  // pointermove was the only thing that could ever start the loop. Anything
  // that can change whether we are in the port calls this instead.
  function maybeHover() {
    if (!s.enabled || !s.inView) return
    if (hoverSpeed() !== 0) hoverStart()
  }

  function onPointerLeave() {
    s.hoverX = -1
    hoverStop()
  }

  // ── The hard clip ─────────────────────────────────────────────────────────
  // Capturing on `wheel` alone is not a clip, it is a wheel feature. Momentum
  // after the fingers lift, keyboard paging, a scrollbar drag, Home/End, a
  // touchpad's inertial tail — none of those are wheel events, and every one of
  // them could carry the visitor straight past the section.
  //
  // This runs on `scroll` instead, which no scroll method can avoid producing,
  // so the stop holds regardless of how the page is being moved.
  // Single scroll entry point. Hover-to-scroll is evaluated on EVERY scroll,
  // deliberately outside onScrollClip's guards: those bail on parkedOnce and
  // released, which is precisely the state a visitor is in when they scroll
  // back to the section — so gating hover behind them left the glide dead on
  // every return visit.
  function onScroll() {
    maybeHover()
    onScrollClip()
  }

  function onScrollClip() {
    if (!s.enabled || s.parking || s.parkedOnce || s.released) return
    const rail = s.rail
    if (!rail || !rail.isConnected) return
    if (s.lightbox && s.lightbox.classList.contains('open')) return

    const y = window.scrollY || 0
    const dir = y >= s.lastScrollY ? 1 : -1
    s.lastScrollY = y

    if (!shouldCapture(dir)) return

    s.lastDir = dir
    s.arrivalGesture = true
    parkPage(dir, () => {
      const carried = s.spent
      rearm()
      s.spent = carried
      s.released = false
    })
  }

  // ── Parking the section ───────────────────────────────────────────────────
  // One easing curve, one owner of window.scrollTo. Any wheel that arrives
  // while this runs is swallowed, so nothing competes for the scroll position.
  function parkTarget() {
    const section = s.rail && s.rail.closest('.about-art')
    if (!section) return null
    const r = section.getBoundingClientRect()
    const vh = window.innerHeight || 1
    // Centre the section in the port. With a 100dvh section this resolves to
    // its own top edge, but the arithmetic holds if it is ever taller.
    return Math.round(r.top + window.scrollY + r.height / 2 - vh / 2)
  }

  function parkPage(dir, onDone) {
    const to = parkTarget()
    if (to === null) { onDone(); return }
    const from = window.scrollY || 0
    const dist = to - from
    // Travelling against the visitor is normally forbidden, but a burst that
    // overshoots the target by a little must still be pulled into the port or
    // the stop is not compulsory. Allow it only while the correction is small
    // enough to read as settling.
    const vh = window.innerHeight || 1
    const reversing = dist * dir < 0
    const pullbackTooFar = reversing && Math.abs(dist) > vh * MAX_PULLBACK_FRACTION
    if (Math.abs(dist) < 2 || pullbackTooFar) {
      s.parking = false
      s.parkedOnce = true
      onDone()
      return
    }

    s.parking = true
    cancelAnimationFrame(s.parkRAF)
    const t0 = performance.now()
    // easeOutCubic — decelerating, so the arrival reads as settling.
    const ease = t => 1 - Math.pow(1 - t, 3)
    const step = now => {
      const t = Math.min(1, (now - t0) / PARK_MS)
      window.scrollTo(0, Math.round(from + dist * ease(t)))
      if (t < 1) {
        s.parkRAF = requestAnimationFrame(step)
      } else {
        s.parking = false
        s.parkedOnce = true
        onDone()
      }
    }
    s.parkRAF = requestAnimationFrame(step)
  }

  // The exit, mirroring the entry. On release the remaining deltas of a fling
  // would otherwise be applied to the page one per event with no easing, which
  // lands as a lurch. Instead the page is carried out of the section on the
  // same curve it came in on, and wheel events are swallowed until it is clear.
  function unparkPage(dir) {
    const section = s.rail && s.rail.closest('.about-art')
    if (!section) return
    const vh = window.innerHeight || 1
    const from = window.scrollY || 0
    const top = Math.round(section.getBoundingClientRect().top + from)
    // One screen beyond the section in the direction of travel: far enough that
    // the section is clear of the port and native scrolling can take over.
    const to = dir > 0 ? top + vh : top - vh
    const dist = to - from
    if (dist * dir <= 0) return

    s.parking = true
    cancelAnimationFrame(s.parkRAF)
    const t0 = performance.now()
    const ease = t => 1 - Math.pow(1 - t, 3)
    const step = now => {
      const t = Math.min(1, (now - t0) / PARK_MS)
      window.scrollTo(0, Math.round(from + dist * ease(t)))
      if (t < 1) s.parkRAF = requestAnimationFrame(step)
      else s.parking = false
    }
    s.parkRAF = requestAnimationFrame(step)
  }

  // Has the section come far enough into the port, travelling `dir`, that we
  // should take the page? Measured on the section, not the rail.
  function shouldCapture(dir) {
    const section = s.rail && s.rail.closest('.about-art')
    if (!section) return false
    const r = section.getBoundingClientRect()
    const vh = window.innerHeight || 1
    const edge = vh * CAPTURE_FRACTION
    // Scrolling down: its top edge has risen past the trigger line.
    // Scrolling up: its bottom edge has fallen past the mirror line.
    return dir > 0 ? r.top <= edge && r.bottom > 0 : r.bottom >= vh - edge && r.top < vh
  }

  function rearm() {
    s.spent = 0
    // Geometry FIRST. The end-of-rail test below reads s.max, and on the very
    // first re-arm s.max is still 0 — which made `scrollLeft >= s.max - EPS`
    // read as 0 >= -1, i.e. "already at the end", and left `released` stuck
    // true so the rail never engaged at all.
    if (s.rail && s.rail.isConnected) {
      s.max = Math.max(0, s.rail.scrollWidth - s.rail.clientWidth)
      s.pos = s.rail.scrollLeft
    }

    // After the geometry, for the same reason: this clamps to s.max, which is
    // 0 until the line above has run.
    s.preview = Math.min(previewDistance(s.rail), s.max)

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

  function release(dir) {
    s.released = true
    // Let the rail settle onto a card now that the gesture is over. Deferred by
    // IDLE_MS so the settle reads as the end of the gesture rather than an
    // animation competing with the page starting to move.
    armIdle()
    // Carry the page out of the section on the entry curve. Without this the
    // fling's remaining deltas land on the page one per event, unimpeded and
    // uneased, which is the lurch at the exit.
    if (dir) unparkPage(dir)
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
    const now = e.timeStamp || performance.now()
    const dir = dy > 0 ? 1 : -1

    // ── Capture ──────────────────────────────────────────────────────────
    // This block MUST run before the in-view guard below. The capture fires
    // while the section is only just entering the port — which is precisely
    // when `s.inView` (90% of the section) is false and the pointer is still
    // over the content above. Behind that guard the capture was unreachable,
    // and the stop could simply be scrolled past.

    // While the page is animating into or out of the port, it stays the only
    // owner of window.scrollTo — but the gesture is NOT swallowed. It drives
    // the rail instead.
    //
    // Swallowing it was a real dead spot: the park runs 760ms and a flick is
    // maybe 300ms of events, so the visitor's entire gesture was consumed by
    // the animation and the rail never moved. The page clipped and then
    // nothing happened, which is exactly the "it clips but does not scroll the
    // artwork" report. Routing the delta into the rail keeps the motion
    // continuous: the page glides into the port while the paintings start
    // moving under the same gesture.
    if (s.parking) {
      e.preventDefault()

      if (!s.max && rail.isConnected) {
        s.max = Math.max(0, rail.scrollWidth - rail.clientWidth)
        s.pos = rail.scrollLeft
      }
      const roomNow = dir > 0 ? s.max - s.pos : s.pos
      if (roomNow > EPS) {
        const next = clamp(s.pos + dy, 0, s.max)
        s.spent += Math.abs(dy)
        s.pos = next
        setDriving(true)
        rail.scrollLeft = next
        armIdle()
      }
      return
    }

    // Take the page before the visitor is past the section.
    if (!s.released && !s.parkedOnce && shouldCapture(dir)) {
      if (big(dy)) s.lastDir = dir
      s.lastTime = now
      // The gesture that arrives can never be the gesture that leaves. A hard
      // fling was capturing, blowing through the preview during the park, and
      // releasing the moment the park ended — one continuous motion, a stop of
      // a few hundred milliseconds that never read as a stop at all. This flag
      // holds until the wheel goes quiet for IDLE_MS.
      s.arrivalGesture = true
      e.preventDefault()
      parkPage(dir, () => {
        // Preserve what the gesture already moved during the park — rearm()
        // zeroes `spent`, and the preview must count that travel or it would
        // silently ask for it twice.
        const carried = s.spent
        rearm()
        s.spent = carried
        s.released = false
      })
      return
    }

    if (!s.inView && !overRail) return

    if (now - s.lastTime > IDLE_MS) s.arrivalGesture = false
    if (now - s.lastTime > IDLE_MS || (big(dy) && dir !== s.lastDir)) rearm()
    s.lastTime = now
    if (big(dy)) s.lastDir = dir
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
        // The preview is compulsory regardless of speed. Travelling right it
        // is a POSITION — the rail must have carried the first painting off
        // the left edge — because that is the landmark the visitor actually
        // sees. Travelling left there is no such landmark, so the same
        // distance is required as an amount instead.
        const previewDone = dir > 0 ? next >= s.preview - EPS : s.spent >= s.preview
        const railEnd = dir > 0 ? next >= s.max - EPS : next <= EPS
        if (
          railEnd ||
          (previewDone && !s.arrivalGesture && velocity(now) >= FAST_VELOCITY)
        ) release(dir)
        return
      }
      // The rail is already at the end in this direction on the very first
      // tick: nothing to run, so let the page have it, this event included.
      // No unpark — there was no gesture to carry out of, and animating here
      // would fight a page that is already moving normally.
      release(0)
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

    // Clear the per-visit capture FIRST, and outside the change guard below.
    // This used to live inside it, which meant it almost never ran: `nowIn`
    // (90% of the section) goes false while the section is still partly on
    // screen, so by the time it finally leaves the viewport `nowIn` has not
    // changed and the callback returned early. parkedOnce stayed true for the
    // rest of the session and the stop never applied again.
    //
    // Deliberately gated on fully out, not on a low ratio: while the visitor
    // is part-way through leaving downwards, shouldCapture() would still be
    // satisfied, so an earlier reset would drag them straight back in.
    if (!entry.isIntersecting) s.parkedOnce = false

    if (nowIn === s.inView) return
    s.inView = nowIn

    if (nowIn) {
      // Arrived (or come back). If the pointer is already sitting in a live
      // zone, the glide should resume without waiting for it to twitch.
      maybeHover()
      return
    }

    hoverStop()
    setDriving(false)
    rearm()
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
  // Passive: hover-to-scroll never blocks the pointer, it only reads position.
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  // Passive: this never blocks the scroll, it only notices one has happened
  // and takes the page from there.
  window.addEventListener('scroll', onScroll, { passive: true })
  // Pointer out of the document entirely (into browser chrome, another window)
  // must stop the glide — otherwise it runs on against a cursor that is gone.
  document.addEventListener('pointerleave', onPointerLeave)
  window.addEventListener('blur', onPointerLeave)
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
