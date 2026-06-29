/* ─────────────────────────────────────────
   index.js — Home page scripts
   ───────────────────────────────────────── */

// ── MOBILE DETECTION ─────────────────────
// Must be declared before the skip-loader block, which calls initMobileShimmer() synchronously.
// If this is below that block, `const isMobile` is in the TDZ → ReferenceError → entire module crashes.
const isMobile = () => window.matchMedia('(max-width: 767px)').matches

// ── MOBILE TWO-STATE ROOM ─────────────────
// Declared before the skip-loader branch because returning from subpages calls
// initMobileShimmer() synchronously before the rest of the module has run.
let mobileExpanded = false
// Timer IDs for expandRoom's delayed cleanup — stored so setMobileOverview
// and pageshow can cancel them before they fire and corrupt overview state.
let _expandClearTimer = null
let _hintHideTimer    = null
let _welcomeHideTimer = null

// ── LOADER ───────────────────────────────
const loader      = document.getElementById('loader')
const loaderNum   = document.getElementById('loader-num')
const loaderLabel = document.getElementById('loader-label')
const loaderVideo = document.getElementById('loader-video')
const loaderWelcome = document.querySelector('.loader-welcome')
const loaderHint    = document.getElementById('loader-hint')
const loaderCounter = document.querySelector('.loader-counter')
const stage       = document.getElementById('stage')

// Mark the stage as ready: reveals the frame-border on mobile (CSS gate).
// Safe to call multiple times — class add is idempotent.
function markRoomReady() {
  if (stage) stage.classList.add('room-ready')
}

function dismissLoader() {
  loader.classList.add('hidden')
  stage.classList.add('visible')
  const header = document.getElementById('site-header')
  const footer = document.getElementById('site-footer')
  if (header) { header.style.animationDelay = '0s'; header.classList.add('fade-up') }
  if (footer) { footer.style.animationDelay = '0.3s'; footer.classList.add('fade-up') }
  initMobileShimmer()
  markRoomReady()
}

// Skip-loader path: triggered by the nav logo and any link back to index.
// The inline script in index.html has already hidden the loader and revealed
// the stage; we just need to apply the overview transform and unlock visibility.
const skipLoader = sessionStorage.getItem('skip-loader')
if (skipLoader) {
  sessionStorage.removeItem('skip-loader')
  if (loader) loader.classList.add('hidden')
  if (stage) stage.classList.add('visible')
  const header = document.getElementById('site-header')
  const footer = document.getElementById('site-footer')
  if (header) { header.classList.add('fade-up'); header.style.animationDelay = '0s' }
  if (footer) { footer.classList.add('fade-up'); footer.style.animationDelay = '0s' }
  initMobileShimmer()
  if (isMobile()) {
    // Apply the overview transform on the next frame, then reveal.
    // On mobile, .frame-border is held at visibility:hidden by CSS until
    // .room-ready is added, so nothing paints at the wrong size.
    requestAnimationFrame(() => {
      mobileExpanded = false
      _cancelExpandTimers()
      setMobileOverview()
      markRoomReady()
    })
  } else {
    markRoomReady()
  }
} else {
  let loadComplete = false

  let count = 0
  const counter = setInterval(() => {
    count += 10
    loaderNum.textContent = count
    if (count === 100) {
      clearInterval(counter)

      // ① Wait 500ms so user sees "100" clearly
      setTimeout(() => {
        // ② Crossfade the finished counter into the tap hint using keyframes.
        //    Double-rAF keeps Safari from merging the before/after states.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (loaderCounter) loaderCounter.classList.add('count-done')
            if (loaderHint) loaderHint.classList.add('visible')

            // ③ After the keyframes fully settle, remove old glyphs from paint
            //    entirely so iOS cannot keep a faint italic stroke around.
            setTimeout(() => {
              if (loaderNum)   { loaderNum.style.visibility = 'hidden'; loaderNum.style.display = 'none' }
              if (loaderLabel) { loaderLabel.style.visibility = 'hidden'; loaderLabel.style.display = 'none' }
              if (loader) loader.classList.add('ready-to-enter')

              loadComplete = true

              // ④ Desktop: auto-dismiss after a further 700ms
              if (!isMobile()) {
                setTimeout(dismissLoader, 700)
              }
              // Mobile: wait for tap (handled below)
            }, 1200)
          })
        })
      }, 500)
    }
  }, 100)

  // Mobile hard gate — tap anywhere on loader to enter
  if (loader) {
    loader.addEventListener('click', () => {
      if (!isMobile()) return
      if (!loadComplete) return   // ignore taps before loading finishes
      dismissLoader()
    }, { passive: true })
  }
}

function _cancelExpandTimers() {
  if (_expandClearTimer) { clearTimeout(_expandClearTimer); _expandClearTimer = null }
  if (_hintHideTimer)    { clearTimeout(_hintHideTimer);    _hintHideTimer    = null }
  if (_welcomeHideTimer) { clearTimeout(_welcomeHideTimer); _welcomeHideTimer = null }
}

function getMobileRatio() {
  const img = document.getElementById('room-img')
  return (img.naturalWidth || 3764) / (img.naturalHeight || 2214)
}

function getMobileViewportHeight() {
  return Math.round(window.visualViewport?.height || window.innerHeight)
}

function getMobileRoomMetrics() {
  const ratio = getMobileRatio()
  const vw = window.innerWidth
  const headerH = 80
  const availH = getMobileViewportHeight() - headerH
  const overviewH = Math.round(vw / ratio)
  const expandH = availH
  const expandW = Math.round(expandH * ratio)
  const scale = overviewH / expandH
  const centerScroll = Math.max(0, (expandW - vw) / 2)

  return { ratio, vw, headerH, availH, overviewH, expandH, expandW, scale, centerScroll }
}

// Overview state: painting at full viewport width, centered vertically
// Strategy: set everything to EXPANDED dimensions upfront, then use
// CSS transform on frame-border to visually scale it down to overview size.
// Only the transform changes on expand/collapse → GPU-composited, zero layout reflow.
function setMobileOverview() {
  // Cancel any pending timers from expandRoom() — prevents BFCache race where
  // a thawed timer fires after pageshow has already restored the overview.
  _cancelExpandTimers()

  const img = document.getElementById('room-img')
  const roomImage = document.getElementById('room-image')
  const frameBorder = document.querySelector('.frame-border')
  const frameMount = document.querySelector('.frame-mount')
  if (!img || !roomImage || !frameMount) return

  const { vw, availH, overviewH, expandH, expandW, scale, centerScroll } = getMobileRoomMetrics()

  // Landscape / short viewport: skip straight to expanded
  if (overviewH >= availH * 0.82) {
    expandRoom(true)
    return
  }

  mobileExpanded = false

  // Set dimensions to full EXPANDED size (transform handles the visual scaling)
  img.style.transition = ''
  img.style.width = expandW + 'px'
  img.style.height = expandH + 'px'
  roomImage.style.width = expandW + 'px'
  roomImage.style.top = ''

  if (frameBorder) {
    frameBorder.style.width = expandW + 'px'
    frameBorder.style.height = expandH + 'px'
    // Instant snap: kill any in-flight transition, then set the overview scale.
    // BFCache may resume a paused transition from expandRoom's 0.75s animation.
    frameBorder.style.transition = 'none'
    void frameBorder.offsetHeight  // force reflow so 'none' commits before transform
    frameBorder.style.transition = ''
    frameBorder.style.transformOrigin = '50% 50%'
    // Do not rely on a hidden scrollLeft to center the scaled painting.
    // iOS can restore or clamp that value during return navigation, which
    // reveals only the right edge of the room. Translate the scaled layer
    // into place directly, then swap back to scroll centering on expand.
    frameBorder.style.transform = `translate(${-centerScroll}px, -24px) scale(${scale})`
  }

  // frame-mount: full height throughout (no height animation ever needed)
  frameMount.style.transition = ''
  frameMount.style.height = availH + 'px'
  frameMount.style.marginTop = ''  // use CSS default (headerH)
  frameMount.style.overflowX = 'hidden'
  frameMount.scrollLeft = 0

  // Show overlay + hint + welcome text
  const ovl = document.getElementById('overview-overlay')
  if (ovl) ovl.classList.remove('hidden')
  const hint = document.getElementById('expand-hint')
  if (hint) hint.classList.remove('hidden', 'fading')
  const welcome = document.querySelector('.room-welcome')
  if (welcome) welcome.classList.remove('hidden', 'fading')
}

// Expanded state: animate frame-border transform from scaled → natural.
// No layout properties change during animation → smooth 60fps on device.
function expandRoom(silent = false) {
  if (mobileExpanded) return
  mobileExpanded = true

  const frameBorder = document.querySelector('.frame-border')
  const frameMount = document.querySelector('.frame-mount')
  const img = document.getElementById('room-img')
  const roomImage = document.getElementById('room-image')
  if (!frameBorder || !frameMount) return

  const { expandH, expandW, scale, centerScroll } = getMobileRoomMetrics()

  // Ensure expanded dimensions are set (may already be from setMobileOverview)
  if (img) { img.style.width = expandW + 'px'; img.style.height = expandH + 'px' }
  if (roomImage) { roomImage.style.width = expandW + 'px'; roomImage.style.top = '' }
  frameBorder.style.width = expandW + 'px'
  frameBorder.style.height = expandH + 'px'
  frameMount.style.height = expandH + 'px'
  frameMount.style.marginTop = ''  // CSS default

  if (silent) {
    // Instant — no animation (landscape auto-expand)
    frameBorder.style.transition = ''
    frameBorder.style.transform = ''
    frameBorder.style.transformOrigin = ''
    frameMount.style.overflowX = 'auto'
    frameMount.scrollLeft = centerScroll
  } else {
    // Start the animation from the same visual overview state, but centered
    // by scrollLeft instead of translateX so the expanded room ends centered.
    frameMount.scrollLeft = centerScroll
    frameBorder.style.transition = 'none'
    frameBorder.style.transformOrigin = '50% 50%'
    frameBorder.style.transform = `scale(${scale})`
    void frameBorder.offsetHeight

    // Animate ONLY the transform — GPU layer, no layout reflow.
    // 0.75s ease-in-out gives a slow, symmetric expansion from the center.
    frameBorder.style.transition = 'transform 0.75s ease-in-out'
    frameBorder.style.transform = 'scale(1)'

    _expandClearTimer = setTimeout(() => {
      _expandClearTimer = null
      // Clear transform (scale(1) = identity, safe to remove)
      frameBorder.style.transition = ''
      frameBorder.style.transform = ''
      frameBorder.style.transformOrigin = ''
      // Unlock horizontal scroll — scrollLeft already positioned correctly
      frameMount.style.overflowX = 'auto'
      frameMount.scrollLeft = centerScroll
    }, 780)
  }

  // Hide overlay so zones receive taps
  const ovl = document.getElementById('overview-overlay')
  if (ovl) ovl.classList.add('hidden')

  // Fade out hint + welcome text
  const hint = document.getElementById('expand-hint')
  if (hint && !hint.classList.contains('hidden')) {
    hint.classList.add('fading')
    _hintHideTimer = setTimeout(() => { _hintHideTimer = null; hint.classList.add('hidden') }, 380)
  }
  const welcome = document.querySelector('.room-welcome')
  if (welcome && !welcome.classList.contains('hidden')) {
    welcome.classList.add('fading')
    _welcomeHideTimer = setTimeout(() => { _welcomeHideTimer = null; welcome.classList.add('hidden') }, 380)
  }

  initMobileShimmer()
}

// ── FIT IMAGE TO SCREEN ───────────────────
function fitRoom() {
  const mobile = window.matchMedia('(max-width: 767px)').matches
  const img = document.getElementById('room-img')
  const roomImage = document.getElementById('room-image')
  const roomLayout = document.getElementById('room-layout')
  const naturalW = img.naturalWidth || 1440
  const naturalH = img.naturalHeight || 856
  const ratio = naturalW / naturalH

  if (mobile) {
    if (mobileExpanded) {
      // Re-apply expanded dimensions on resize
      const { headerH, expandH, expandW, centerScroll } = getMobileRoomMetrics()
      img.style.width = expandW + 'px'
      img.style.height = expandH + 'px'
      roomImage.style.width = expandW + 'px'
      const frameBorder = document.querySelector('.frame-border')
      if (frameBorder) {
        frameBorder.style.width = expandW + 'px'
        frameBorder.style.height = expandH + 'px'
        frameBorder.style.transform = ''       // clear any overview-state transform
        frameBorder.style.transformOrigin = ''
      }
      const frameMount = document.querySelector('.frame-mount')
      if (frameMount) {
        frameMount.style.height = expandH + 'px'
        frameMount.style.marginTop = headerH + 'px'
        frameMount.style.overflowX = 'auto'
        frameMount.scrollLeft = centerScroll
      }
    } else {
      setMobileOverview()
    }
    return
  }

  // Desktop: clear all mobile-applied inline styles
  const frameBorder = document.querySelector('.frame-border')
  if (frameBorder) { frameBorder.style.width = ''; frameBorder.style.height = '' }
  const frameMount = document.querySelector('.frame-mount')
  if (frameMount) { frameMount.style.height = ''; frameMount.style.marginTop = ''; frameMount.style.overflowX = '' }

  const padding = 64 + 32 + 3
  const statement = document.querySelector('.room-statement')
  const welcome = document.querySelector('.room-welcome')
  const statementH = statement?.offsetHeight || 0
  const welcomeH = welcome?.offsetHeight || 0
  const textReserve = statementH + welcomeH + 56
  const headerFooter = Math.max(120, textReserve)
  const maxW = window.innerWidth - padding - 40
  const maxH = window.innerHeight - headerFooter - padding
  let w = maxW, h = w / ratio
  if (h > maxH) { h = maxH; w = h * ratio }
  img.style.width = w + 'px'
  img.style.height = h + 'px'
  roomImage.style.width = w + 'px'
  roomImage.style.height = h + 'px'
  if (roomLayout) roomLayout.style.width = w + 'px'
}

// ── MOBILE TAP-TO-EXPAND ─────────────────
function initPinchExpand() {
  if (!isMobile()) return
  const ovl = document.getElementById('overview-overlay')
  if (!ovl) return
  // Single tap on the painting expands to full-height interactive mode
  ovl.addEventListener('click', () => { expandRoom() })
}

const img = document.getElementById('room-img')
if (img.complete) { fitRoom() } else { img.addEventListener('load', fitRoom) }
window.addEventListener('resize', fitRoom)
window.addEventListener('load', () => {
  fitRoom()
  initPinchExpand()
})

// Re-fit and re-shimmer when returning via browser back (BFCache restore)
window.addEventListener('pageshow', e => {
  if (e.persisted) {
    // Cancel any thawed timers immediately (synchronous — before any rAF)
    _cancelExpandTimers()
    if (isMobile()) {
      // Reset state flags synchronously so no code after this sees stale values
      mobileExpanded = false
      document.querySelectorAll('.zone.shimmer').forEach(z => z.classList.remove('shimmer'))
      // Use double-rAF so the browser has fully committed the BFCache-restored
      // paint before we recalculate layout and re-apply the overview scale.
      // (A single rAF can still run before the first composited frame is shown.)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setMobileOverview()
          initMobileShimmer()
          markRoomReady()
        })
      })
    } else {
      fitRoom()
      initMobileShimmer()
      markRoomReady()
    }
  }
})

// ── PRELOAD OVERLAY VIDEOS ────────────────
// Set sources immediately so videos are buffered before first tap/hover
function preloadOverlays() {
  const overlays = [
    { id: 'vinyl-overlay',       webm: '/hotspot/vinyl.webm',       mp4: '/hotspot/vinyl.mp4' },
    { id: 'bulb-overlay',        webm: '/hotspot/bulb.webm',        mp4: '/hotspot/bulb.mp4' },
    { id: 'camera-overlay',      webm: '/hotspot/camera.webm',      mp4: '/hotspot/camera.mp4' },
    { id: 'frenchpress-overlay', webm: '/hotspot/frenchpress.webm', mp4: '/hotspot/frenchpress.mp4' },
    { id: 'bed-overlay',         webm: '/hotspot/bed.webm',         mp4: '/hotspot/bed.mp4' },
    { id: 'laptop-overlay',     webm: '/hotspot/laptop.webm',      mp4: '/hotspot/laptop.mp4' },
  ]
  overlays.forEach(({ id, webm, mp4, playbackRate }) => {
    const el = document.getElementById(id)
    if (!el) return
    el.innerHTML = `<source src="${webm}" type="video/webm"><source src="${mp4}" type="video/mp4">`
    if (playbackRate) {
      el.playbackRate = playbackRate
      // Re-apply after load() since some browsers reset playbackRate
      el.addEventListener('canplay', () => { el.playbackRate = playbackRate }, { once: false })
    }
    el.load()
  })
}
preloadOverlays()

// Hide all overlays and the revealed bottom link card
function hideAllOverlays() {
  ;['vinyl-overlay', 'bulb-overlay', 'camera-overlay', 'frenchpress-overlay', 'bed-overlay', 'laptop-overlay'].forEach(id => {
    const el = document.getElementById(id)
    if (!el) return
    el.classList.remove('active')
    if (el.tagName === 'VIDEO') { el.pause(); el.currentTime = 0 }
  })
  hideRevealedLink()
}

// ── VINYL HOTSPOT ─────────────────────────
const vinylHotspot = document.getElementById('vinyl-hotspot')
const vinylOverlay = document.getElementById('vinyl-overlay')

if (vinylHotspot && vinylOverlay) {
  function showVinyl() { vinylOverlay.classList.add('active'); vinylOverlay.currentTime = 0; vinylOverlay.play().catch(() => {}) }
  function hideVinyl() { vinylOverlay.classList.remove('active'); vinylOverlay.pause(); vinylOverlay.currentTime = 0 }

  // Desktop: hover
  vinylHotspot.addEventListener('mouseenter', () => {
    if (isMobile()) return
    showVinyl()
    window.cursorMorphTo('🎶')
    ttLabel.textContent = 'The Record'
    ttDesc.textContent = 'Music & Vibes'
    ttLink.textContent = 'View Records'
    ttLink.href = 'record.html'
    ttLink.target = '_self'
    tooltip.classList.add('visible')
  })
  vinylHotspot.addEventListener('mouseleave', () => {
    if (isMobile()) return
    hideVinyl()
    window.cursorMorphBack()
    tooltip.classList.remove('visible')
  })

  function navigateVinyl() {
    if (window.__softNavigate) {
      window.__softNavigate('record.html')
    } else {
      window.location.href = 'record.html'
    }
  }

  // Mobile: tap once → show gif + reveal link card, tap again → navigate
  vinylHotspot.addEventListener('click', () => {
    if (isMobile()) {
      if (vinylOverlay.classList.contains('active')) {
        navigateVinyl()
      } else {
        removeShimmer()
        hideAllOverlays()
        showVinyl()
        revealLink('The Record')
      }
    } else {
      navigateVinyl()
    }
  })

  // Clicking the gif navigates to record page (desktop + mobile)
  vinylOverlay.addEventListener('click', navigateVinyl)

  // Desktop: gif keeps itself active while hovered
  vinylOverlay.addEventListener('mouseenter', () => {
    if (isMobile()) return
    showVinyl()
    window.cursorMorphTo('🎶')
    ttLabel.textContent = 'The Record'
    ttDesc.textContent = 'Music & Vibes'
    ttLink.textContent = 'View Records'
    ttLink.href = 'record.html'
    ttLink.target = '_self'
    tooltip.classList.add('visible')
  })
  vinylOverlay.addEventListener('mouseleave', () => {
    if (isMobile()) return
    hideVinyl()
    window.cursorMorphBack()
    tooltip.classList.remove('visible')
  })
}

// ── BULB HOTSPOT ──────────────────────────
const bulbHotspot = document.getElementById('bulb-hotspot')
const bulbOverlay = document.getElementById('bulb-overlay')

if (bulbHotspot && bulbOverlay) {
  function showBulb() { bulbOverlay.classList.add('active'); bulbOverlay.currentTime = 0; bulbOverlay.play().catch(() => {}) }
  function hideBulb() { bulbOverlay.classList.remove('active'); bulbOverlay.pause(); bulbOverlay.currentTime = 0 }

  // Desktop: hover
  bulbHotspot.addEventListener('mouseenter', () => {
    if (isMobile()) return
    showBulb()
    window.cursorMorphTo('✦')
    ttLabel.textContent = 'The Lamp'
    ttDesc.textContent = 'AI & Automation'
    ttLink.textContent = 'View Tools'
    ttLink.href = 'ai.html'
    ttLink.target = '_self'
    tooltip.classList.add('visible')
  })
  bulbHotspot.addEventListener('mouseleave', () => {
    if (isMobile()) return
    hideBulb()
    window.cursorMorphBack()
    tooltip.classList.remove('visible')
  })

  function navigateBulb() {
    if (window.__softNavigate) {
      window.__softNavigate('ai.html')
    } else {
      window.location.href = 'ai.html'
    }
  }

  // Mobile: tap once → show gif + reveal link card, tap again → navigate
  bulbHotspot.addEventListener('click', () => {
    if (isMobile()) {
      if (bulbOverlay.classList.contains('active')) {
        navigateBulb()
      } else {
        removeShimmer()
        hideAllOverlays()
        showBulb()
        revealLink('The Lamp')
      }
    } else {
      navigateBulb()
    }
  })

  // Clicking the gif navigates to contact page (desktop + mobile)
  bulbOverlay.addEventListener('click', navigateBulb)

  // Desktop: gif keeps itself active while hovered
  bulbOverlay.addEventListener('mouseenter', () => {
    if (isMobile()) return
    showBulb()
    window.cursorMorphTo('✦')
    ttLabel.textContent = 'The Lamp'
    ttDesc.textContent = 'AI & Automation'
    ttLink.textContent = 'View Tools'
    ttLink.href = 'ai.html'
    ttLink.target = '_self'
    tooltip.classList.add('visible')
  })
  bulbOverlay.addEventListener('mouseleave', () => {
    if (isMobile()) return
    hideBulb()
    window.cursorMorphBack()
    tooltip.classList.remove('visible')
  })
}

// ── CAMERA HOTSPOT ────────────────────────
const cameraHotspot = document.getElementById('camera-hotspot')
const cameraOverlay = document.getElementById('camera-overlay')

if (cameraHotspot && cameraOverlay) {
  function showCamera() { cameraOverlay.classList.add('active'); cameraOverlay.currentTime = 0; cameraOverlay.play().catch(() => {}) }
  function hideCamera() { cameraOverlay.classList.remove('active'); cameraOverlay.pause(); cameraOverlay.currentTime = 0 }

  // Desktop: hover
  cameraHotspot.addEventListener('mouseenter', () => {
    if (isMobile()) return
    showCamera()
    window.cursorMorphTo('📷')
    ttLabel.textContent = 'The Fujifilm Camera'
    ttDesc.textContent = 'Photography'
    ttLink.textContent = 'View Work'
    ttLink.href = 'photography.html'
    ttLink.target = '_self'
    tooltip.classList.add('visible')
  })
  cameraHotspot.addEventListener('mouseleave', () => {
    if (isMobile()) return
    hideCamera()
    window.cursorMorphBack()
    tooltip.classList.remove('visible')
  })

  function navigateCamera() {
    if (window.__softNavigate) {
      window.__softNavigate('photography.html')
    } else {
      window.location.href = 'photography.html'
    }
  }

  // Mobile: tap once → show gif + reveal link card, tap again → navigate
  cameraHotspot.addEventListener('click', () => {
    if (isMobile()) {
      if (cameraOverlay.classList.contains('active')) {
        navigateCamera()
      } else {
        removeShimmer()
        hideAllOverlays()
        showCamera()
        revealLink('The Fujifilm Camera')
      }
    } else {
      navigateCamera()
    }
  })

  // Clicking the gif navigates to photography page (desktop + mobile)
  cameraOverlay.addEventListener('click', navigateCamera)

  // Desktop: gif keeps itself active while hovered
  cameraOverlay.addEventListener('mouseenter', () => {
    if (isMobile()) return
    showCamera()
    window.cursorMorphTo('📷')
    ttLabel.textContent = 'The Fujifilm Camera'
    ttDesc.textContent = 'Photography'
    ttLink.textContent = 'View Work'
    ttLink.href = 'photography.html'
    ttLink.target = '_self'
    tooltip.classList.add('visible')
  })
  cameraOverlay.addEventListener('mouseleave', () => {
    if (isMobile()) return
    hideCamera()
    window.cursorMorphBack()
    tooltip.classList.remove('visible')
  })
}

// ── FRENCH PRESS HOTSPOT ──────────────────
const frenchpressHotspot = document.getElementById('frenchpress-hotspot')
const frenchpressOverlay = document.getElementById('frenchpress-overlay')

if (frenchpressHotspot && frenchpressOverlay) {
  function showFrenchpress() { frenchpressOverlay.classList.add('active'); frenchpressOverlay.currentTime = 0; frenchpressOverlay.play().catch(() => {}) }
  function hideFrenchpress() { frenchpressOverlay.classList.remove('active'); frenchpressOverlay.pause(); frenchpressOverlay.currentTime = 0 }

  // Desktop: hover
  frenchpressHotspot.addEventListener('mouseenter', () => {
    if (isMobile()) return
    showFrenchpress()
    window.cursorMorphTo('☕')
    ttLabel.textContent = 'The French Press'
    ttDesc.textContent = 'Personal Aesthetics'
    ttLink.textContent = 'View Curation'
    ttLink.href = 'cosmos.html'
    ttLink.target = '_self'
    tooltip.classList.add('visible')
  })
  frenchpressHotspot.addEventListener('mouseleave', () => {
    if (isMobile()) return
    hideFrenchpress()
    window.cursorMorphBack()
    tooltip.classList.remove('visible')
  })

  function navigateFrenchpress() {
    if (window.__softNavigate) {
      window.__softNavigate('cosmos.html')
    } else {
      window.location.href = 'cosmos.html'
    }
  }

  // Mobile: tap once → show gif + reveal link card, tap again → navigate
  frenchpressHotspot.addEventListener('click', () => {
    if (isMobile()) {
      if (frenchpressOverlay.classList.contains('active')) {
        navigateFrenchpress()
      } else {
        removeShimmer()
        hideAllOverlays()
        showFrenchpress()
        revealLink('The French Press')
      }
    } else {
      navigateFrenchpress()
    }
  })

  // Clicking the gif navigates to cosmos page (desktop + mobile)
  frenchpressOverlay.addEventListener('click', navigateFrenchpress)

  // Desktop: gif keeps itself active while hovered
  frenchpressOverlay.addEventListener('mouseenter', () => {
    if (isMobile()) return
    showFrenchpress()
    window.cursorMorphTo('☕')
    ttLabel.textContent = 'The French Press'
    ttDesc.textContent = 'Personal Aesthetics'
    ttLink.textContent = 'View Curation'
    ttLink.href = 'cosmos.html'
    ttLink.target = '_self'
    tooltip.classList.add('visible')
  })
  frenchpressOverlay.addEventListener('mouseleave', () => {
    if (isMobile()) return
    hideFrenchpress()
    window.cursorMorphBack()
    tooltip.classList.remove('visible')
  })
}

// ── BED HOTSPOT ───────────────────────────
const bedHotspot = document.getElementById('bed-hotspot')
const bedOverlay = document.getElementById('bed-overlay')

if (bedHotspot && bedOverlay) {
  function showBed() { bedOverlay.classList.add('active'); bedOverlay.currentTime = 0; bedOverlay.play().catch(() => {}) }
  function hideBed() { bedOverlay.classList.remove('active'); bedOverlay.pause(); bedOverlay.currentTime = 0 }

  // Desktop: hover
  bedHotspot.addEventListener('mouseenter', () => {
    if (isMobile()) return
    showBed()
    window.cursorMorphTo('🛏')
    ttLabel.textContent = 'The Bed'
    ttDesc.textContent = 'Who I Am'
    ttLink.textContent = 'About'
    ttLink.href = 'about.html'
    ttLink.target = '_self'
    tooltip.classList.add('visible')
  })
  bedHotspot.addEventListener('mouseleave', () => {
    if (isMobile()) return
    hideBed()
    window.cursorMorphBack()
    tooltip.classList.remove('visible')
  })

  function navigateBed() {
    if (window.__softNavigate) {
      window.__softNavigate('about.html')
    } else {
      window.location.href = 'about.html'
    }
  }

  // Mobile: tap once → show gif + reveal link card, tap again → navigate
  bedHotspot.addEventListener('click', () => {
    if (isMobile()) {
      if (bedOverlay.classList.contains('active')) {
        navigateBed()
      } else {
        removeShimmer()
        hideAllOverlays()
        showBed()
        revealLink('The Bed')
      }
    } else {
      navigateBed()
    }
  })

  // Clicking the gif navigates to about page (desktop + mobile)
  bedOverlay.addEventListener('click', navigateBed)

  // Desktop: gif keeps itself active while hovered
  bedOverlay.addEventListener('mouseenter', () => {
    if (isMobile()) return
    showBed()
    window.cursorMorphTo('🛏')
    ttLabel.textContent = 'The Bed'
    ttDesc.textContent = 'Who I Am'
    ttLink.textContent = 'About'
    ttLink.href = 'about.html'
    ttLink.target = '_self'
    tooltip.classList.add('visible')
  })
  bedOverlay.addEventListener('mouseleave', () => {
    if (isMobile()) return
    hideBed()
    window.cursorMorphBack()
    tooltip.classList.remove('visible')
  })
}

// ── LAPTOP HOTSPOT ────────────────────────
const laptopHotspot = document.getElementById('laptop-hotspot')
const laptopOverlay = document.getElementById('laptop-overlay')

if (laptopHotspot && laptopOverlay) {
  let laptopFreezeTimer = null

  function playLaptop() {
    laptopOverlay.playbackRate = 10
    laptopOverlay.currentTime = 0
    laptopOverlay.play().catch(() => {})
  }

  // First second at 10×, then linearly ease from 5× down to 1× by end
  laptopOverlay.addEventListener('timeupdate', () => {
    if (!laptopOverlay.classList.contains('active')) return
    const t = laptopOverlay.currentTime
    const dur = laptopOverlay.duration
    if (t < 1) {
      // Ramp from 1× at start up to 10× at t=1s
      laptopOverlay.playbackRate = 1 + 9 * t
    } else if (dur && dur > 1) {
      const progress = (t - 1) / (dur - 1) // 0 → 1 over the post-first-second window
      laptopOverlay.playbackRate = Math.max(1, 5 - 4 * progress) // 5× → 1×
    } else {
      laptopOverlay.playbackRate = 5
    }
  })

  function showLaptop() {
    laptopOverlay.classList.add('active')
    playLaptop()
  }

  function hideLaptop() {
    laptopOverlay.classList.remove('active')
    laptopOverlay.pause()
    laptopOverlay.currentTime = 0
    clearTimeout(laptopFreezeTimer)
  }

  // On end: freeze for 2s on last frame, then loop
  laptopOverlay.addEventListener('ended', () => {
    if (!laptopOverlay.classList.contains('active')) return
    laptopFreezeTimer = setTimeout(() => {
      if (laptopOverlay.classList.contains('active')) playLaptop()
    }, 2000)
  })

  // Desktop: hover
  laptopHotspot.addEventListener('mouseenter', () => {
    if (isMobile()) return
    showLaptop()
    window.cursorMorphTo('💻')
    ttLabel.textContent = 'The Laptop'
    ttDesc.textContent = 'Work & Projects'
    ttLink.textContent = 'View Work'
    ttLink.href = 'work.html'
    ttLink.target = '_self'
    tooltip.classList.add('visible')
  })
  laptopHotspot.addEventListener('mouseleave', () => {
    if (isMobile()) return
    hideLaptop()
    window.cursorMorphBack()
    tooltip.classList.remove('visible')
  })

  function navigateLaptop() {
    if (window.__softNavigate) {
      window.__softNavigate('work.html')
    } else {
      window.location.href = 'work.html'
    }
  }

  // Mobile: tap once → show overlay + reveal link card, tap again → navigate
  laptopHotspot.addEventListener('click', () => {
    if (isMobile()) {
      if (laptopOverlay.classList.contains('active')) {
        navigateLaptop()
      } else {
        removeShimmer()
        hideAllOverlays()
        showLaptop()
        revealLink('The Laptop')
      }
    } else {
      navigateLaptop()
    }
  })

  laptopOverlay.addEventListener('click', navigateLaptop)

  laptopOverlay.addEventListener('mouseenter', () => {
    if (isMobile()) return
    showLaptop()
    window.cursorMorphTo('💻')
    ttLabel.textContent = 'The Laptop'
    ttDesc.textContent = 'Work & Projects'
    ttLink.textContent = 'View Work'
    ttLink.href = 'work.html'
    ttLink.target = '_self'
    tooltip.classList.add('visible')
  })
  laptopOverlay.addEventListener('mouseleave', () => {
    if (isMobile()) return
    hideLaptop()
    window.cursorMorphBack()
    tooltip.classList.remove('visible')
  })
}

// ── ZONE INTERACTIONS ─────────────────────
const tooltip = document.getElementById('tooltip')
const ttLabel = document.getElementById('tt-label')
const ttDesc = document.getElementById('tt-desc')
const ttLink = document.getElementById('tt-link')

const mobileLinkContainer = document.getElementById('mobile-links')
const mobileLinks = document.querySelectorAll('.mobile-link')
const labelToLink = {}
mobileLinks.forEach(link => {
  const label = link.querySelector('.mobile-link-label')
  if (label) labelToLink[label.textContent.trim()] = link
})

// Track which zone was last tapped (for tap-again-to-navigate)
let lastTappedZone = null

// Reveal a single link card at the bottom (mobile only)
function revealLink(label) {
  if (!isMobile()) return
  const link = labelToLink[label]
  if (!link) return
  mobileLinks.forEach(l => l.classList.remove('revealed'))
  mobileLinkContainer.classList.remove('revealed')
  void mobileLinkContainer.offsetWidth  // restart slide-up animation
  mobileLinkContainer.classList.add('revealed')
  link.classList.add('revealed')
}

function hideRevealedLink() {
  if (!mobileLinkContainer) return
  mobileLinks.forEach(l => l.classList.remove('revealed'))
  mobileLinkContainer.classList.remove('revealed')
}

function removeShimmer() {
  document.querySelectorAll('.zone.shimmer').forEach(z => z.classList.remove('shimmer'))
}

function initMobileShimmer() {
  if (!isMobile()) return
  if (!mobileExpanded) return // shimmer only after expansion
  document.querySelectorAll('.zone').forEach((zone, i) => {
    zone.classList.add('shimmer')
    zone.style.setProperty('--shimmer-delay', `${(i * 0.35) % 2.4}s`)
  })
}

// ── INIT PINCH EXPAND ────────────────────
// Call after DOM is ready (module is deferred; load may already have fired)
if (document.readyState === 'complete') {
  initPinchExpand()
} else {
  window.addEventListener('load', initPinchExpand, { once: true })
}

document.querySelectorAll('.zone').forEach(zone => {
  // Desktop: hover + click
  zone.addEventListener('mouseenter', () => {
    if (isMobile()) return
    window.cursorMorphTo(zone.dataset.emoji)
    ttLabel.textContent = zone.dataset.label
    ttDesc.textContent = zone.dataset.desc
    ttLink.textContent = zone.dataset.linkText
    ttLink.href = zone.dataset.href
    ttLink.target = zone.dataset.external === 'true' ? '_blank' : '_self'
    tooltip.classList.add('visible')
  })

  zone.addEventListener('mouseleave', () => {
    if (isMobile()) return
    window.cursorMorphBack()
    tooltip.classList.remove('visible')
  })

  zone.addEventListener('click', () => {
    if (isMobile()) {
      removeShimmer()

      if (lastTappedZone === zone) {
        // Second tap → navigate
        if (zone.dataset.external === 'true') {
          window.open(zone.dataset.href, '_blank')
        } else {
          if (window.__softNavigate) { window.__softNavigate(zone.dataset.href) } else { window.location.href = zone.dataset.href }
        }
        lastTappedZone = null
        return
      }

      // First tap → reveal the matching link card
      lastTappedZone = zone
      revealLink(zone.dataset.label)
    } else {
      // Desktop: click navigates immediately
      if (zone.dataset.external === 'true') {
        window.open(zone.dataset.href, '_blank')
      } else {
        if (window.__softNavigate) { window.__softNavigate(zone.dataset.href) } else { window.location.href = zone.dataset.href }
      }
    }
  })
})

// ── NAV LOGO ─────────────────────────────────────────────────
// Tapping "Shina Foo" while on index.html triggers a full page reload
// (router.js does NOT set skip-loader in this case), so the loader
// animation plays again — giving the "fresh landing page" experience.
// No interceptor needed here; the router + browser handle navigation.
