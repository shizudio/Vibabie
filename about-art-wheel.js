/**
 * about-art-wheel.js — pinned art rail with hover-driven travel.
 *
 * TOTAL REWRITE, and the reason matters: the previous version intercepted
 * wheel events and animated window.scrollTo against native momentum. Those two
 * can never coexist smoothly — the trackpad keeps delivering momentum the
 * browser has already spent, so every capture landed as a jerk and every
 * release as a lurch, and each fix added another state machine to a fight that
 * should not exist. Ten commits of tuning never touched the root cause.
 *
 * The rule now: NOTHING here ever calls preventDefault, and nothing ever
 * writes window.scrollTo. The page scrolls natively, always. Instead:
 *
 *   - The section is a sticky PIN (see about.css): it carries a fixed amount
 *     of extra scroll height and its content stays fixed on screen while the
 *     visitor scrolls through it. That is the dwell — time in front of the
 *     paintings — and it is ALL the pin does. Scroll progress does not drive
 *     the rail; the owner ruled that auto-carousel out.
 *   - The rail moves only when the visitor moves it: the hover glide in the
 *     side zones (with a neutral strip at the centre), or a direct swipe.
 *   - The gentle per-section pauses are CSS scroll-snap (y proximity), which
 *     is native, momentum-friendly, and skippable.
 *
 * Desktop only (fine pointer, >=1024px). Under prefers-reduced-motion the pin
 * collapses (CSS) and this module leaves the rail fully native.
 *
 * ── Soft-nav ──────────────────────────────────────────────────────────────
 * about.html is soft-navigated: <main> is swapped and this module re-executes
 * cache-busted on every arrival, so the controller lives once per document at
 * window.__shizArtRailWheel and later runs only re-attach the new rail.
 */

// The pin's extra scroll height, in viewports. The section stays pinned on
// screen for this much scrolling — the dwell — but the scroll does NOT drive
// the rail: the owner ruled out the auto-carousel. The paintings move only
// when the visitor moves them, by hover velocity or a direct swipe. The pin
// just buys the time to do it.
const PIN_EXTRA_VH = 0.75

// Hover glide: the strip either side of centre where the pointer rests without
// the rail drifting, and the ramp to full speed at the screen edges.
const HOVER_DEAD_BAND = 0.12
const HOVER_MAX_SPEED = 1.0 // px per ms at the very edge
const HOVER_ZONE = 0.5      // each live zone is (0.5 - deadband/2) of the width

const MIN_WIDTH = 1024
const EPS = 1

function controller() {
  const s = {
    rail: null,
    section: null,
    enabled: false,
    max: 0,
    inView: false,
    hoverX: -1,
    hoverRAF: 0,
    hoverLast: 0,
    lightbox: null,
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

  const mqFine = window.matchMedia('(hover: hover) and (pointer: fine)')
  const mqWide = window.matchMedia(`(min-width: ${MIN_WIDTH}px)`)
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)')

  function refreshEnabled() {
    s.enabled = mqFine.matches && mqWide.matches && !mqReduce.matches
    if (!s.enabled && s.section) s.section.style.removeProperty('--art-pin-extra')
  }

  // ── Geometry ──────────────────────────────────────────────────────────────
  // One measurement pass, on attach and resize — never per scroll frame.
  function measure() {
    const rail = s.rail
    if (!rail || !rail.isConnected) return
    s.max = Math.max(0, rail.scrollWidth - rail.clientWidth)
    if (s.enabled && s.section) {
      // The CSS var so the stylesheet owns the layout, this module the number.
      s.section.style.setProperty(
        '--art-pin-extra',
        Math.round((window.innerHeight || 800) * PIN_EXTRA_VH) + 'px'
      )
    }
  }

  // ── Hover glide ───────────────────────────────────────────────────────────
  function hoverSpeed() {
    if (s.hoverX < 0 || !s.inView) return 0
    const vw = window.innerWidth || 1
    const mid = vw * (1 - HOVER_ZONE)
    const half = (vw * HOVER_DEAD_BAND) / 2
    if (s.hoverX >= mid + half) {
      const start = mid + half
      return Math.min(1, (s.hoverX - start) / Math.max(1, vw - start)) * HOVER_MAX_SPEED
    }
    if (s.hoverX <= mid - half) {
      const rail = s.rail
      if (!rail || rail.scrollLeft <= EPS) return 0
      const start = mid - half
      return -Math.min(1, (start - s.hoverX) / Math.max(1, start)) * HOVER_MAX_SPEED
    }
    return 0
  }

  function hoverStop() {
    cancelAnimationFrame(s.hoverRAF)
    s.hoverRAF = 0
    s.hoverLast = 0
  }

  function hoverTick(now) {
    const rail = s.rail
    if (!rail || !rail.isConnected || !s.enabled || !s.inView) { hoverStop(); return }
    if (!s.lightbox) s.lightbox = document.getElementById('art-lightbox')
    if (s.lightbox && s.lightbox.classList.contains('open')) { hoverStop(); return }

    const speed = hoverSpeed()
    if (speed === 0) { hoverStop(); return }

    const dt = s.hoverLast ? Math.min(64, now - s.hoverLast) : 16
    s.hoverLast = now
    rail.scrollLeft = clamp(rail.scrollLeft + speed * dt, 0, s.max)
    s.hoverRAF = requestAnimationFrame(hoverTick)
  }

  function maybeHover() {
    if (!s.enabled || !s.inView || s.hoverRAF) return
    if (hoverSpeed() !== 0) {
      s.hoverLast = 0
      s.hoverRAF = requestAnimationFrame(hoverTick)
    }
  }

  function onPointerMove(e) {
    s.hoverX = e.clientX
    maybeHover()
  }
  function onPointerGone() {
    s.hoverX = -1
    hoverStop()
  }

  // ── Visibility ────────────────────────────────────────────────────────────
  const io = new IntersectionObserver(entries => {
    const entry = entries[entries.length - 1]
    s.inView = entry.isIntersecting
    if (s.inView) maybeHover()
    else hoverStop()
  }, { threshold: [0, 0.01] })

  let resizeTimer = 0
  function onResize() {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      refreshEnabled()
      measure()
    }, 120)
  }

  refreshEnabled()
  const onMq = () => { refreshEnabled(); measure() }
  mqFine.addEventListener ? mqFine.addEventListener('change', onMq) : mqFine.addListener(onMq)
  mqWide.addEventListener ? mqWide.addEventListener('change', onMq) : mqWide.addListener(onMq)
  mqReduce.addEventListener ? mqReduce.addEventListener('change', onMq) : mqReduce.addListener(onMq)

  // All passive. Nothing in this module can block a scroll.
  window.addEventListener('resize', onResize)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  document.addEventListener('pointerleave', onPointerGone)
  window.addEventListener('blur', onPointerGone)

  return {
    attach(rail) {
      if (s.rail && s.rail !== rail) {
        io.unobserve(s.rail)
        delete s.rail.dataset.artWheelBound
      }
      s.rail = rail
      s.section = rail.closest('.about-art')
      s.lightbox = document.getElementById('art-lightbox')
      rail.dataset.artWheelBound = '1'
      io.observe(rail)
      refreshEnabled()
      // Images may still be laying out; measure now and again shortly after.
      measure()
      setTimeout(measure, 400)
    },
  }
}

export function initArtRailWheel(rail) {
  if (!rail) return
  if (!window.__shizArtRailWheel) window.__shizArtRailWheel = controller()
  if (rail.dataset.artWheelBound) return
  window.__shizArtRailWheel.attach(rail)
}
