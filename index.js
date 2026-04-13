/* ─────────────────────────────────────────
   index.js — Home page scripts
   ───────────────────────────────────────── */

// ── MOBILE DETECTION ─────────────────────
// Must be declared before the skip-loader block, which calls initMobileShimmer() synchronously.
// If this is below that block, `const isMobile` is in the TDZ → ReferenceError → entire module crashes.
const isMobile = () => window.matchMedia('(max-width: 767px)').matches

// ── LOADER ───────────────────────────────
const loader = document.getElementById('loader')
const loaderNum = document.getElementById('loader-num')
const loaderVideo = document.getElementById('loader-video')
const stage = document.getElementById('stage')
const hangingString = document.getElementById('hanging-string')

// Skip loader when returning from a subpage
const skipLoader = sessionStorage.getItem('skip-loader')
if (skipLoader) {
  sessionStorage.removeItem('skip-loader')
  if (loader) loader.classList.add('hidden')
  if (stage) stage.classList.add('visible')
  if (hangingString) hangingString.classList.add('visible')
  const header = document.getElementById('site-header')
  const footer = document.getElementById('site-footer')
  if (header) { header.classList.add('fade-up'); header.style.animationDelay = '0s' }
  if (footer) { footer.classList.add('fade-up'); footer.style.animationDelay = '0s' }
  initMobileShimmer()
} else {
  let count = 0
  const counter = setInterval(() => {
    count += 10
    loaderNum.textContent = count
    if (count === 100) {
      clearInterval(counter)
      setTimeout(() => {
        loader.classList.add('hidden')
        stage.classList.add('visible')
        hangingString.classList.add('visible')

        // Stagger entrance animations after loader
        const header = document.getElementById('site-header')
        const footer = document.getElementById('site-footer')
        if (header) { header.style.animationDelay = '0s'; header.classList.add('fade-up') }
        if (footer) { footer.style.animationDelay = '0.3s'; footer.classList.add('fade-up') }
        initMobileShimmer()
      }, 800)
    }
  }, 100)
}

// ── FIT IMAGE TO SCREEN ───────────────────
function fitRoom() {
  const mobile = window.matchMedia('(max-width: 767px)').matches
  const img = document.getElementById('room-img')
  const roomImage = document.getElementById('room-image')
  const naturalW = img.naturalWidth || 1440
  const naturalH = img.naturalHeight || 856
  const ratio = naturalW / naturalH

  if (mobile) {
    // Fill available height at natural aspect ratio;
    // frame-border is set to the same width so frame-mount can scroll horizontally.
    const headerH = 80 // matches --layout-content-top-mobile
    const availH = window.innerHeight - headerH
    const h = availH
    const w = h * ratio
    img.style.width = w + 'px'
    img.style.height = h + 'px'
    roomImage.style.width = w + 'px'
    roomImage.style.height = h + 'px'
    // Expand frame-border so frame-mount scroll width matches the image width
    const frameBorder = document.querySelector('.frame-border')
    if (frameBorder) frameBorder.style.width = w + 'px'
    // Scroll to center the image so the initial view matches the old centered crop
    const frameMount = document.querySelector('.frame-mount')
    if (frameMount) frameMount.scrollLeft = (w - window.innerWidth) / 2
    return
  }

  // Reset frame-border width in case we came from a mobile layout
  const frameBorder = document.querySelector('.frame-border')
  if (frameBorder) frameBorder.style.width = ''

  const padding = 64 + 32 + 3
  const headerFooter = 120
  const maxW = window.innerWidth - padding - 40
  const maxH = window.innerHeight - headerFooter - padding
  let w = maxW, h = w / ratio
  if (h > maxH) { h = maxH; w = h * ratio }
  img.style.width = w + 'px'
  img.style.height = h + 'px'
  roomImage.style.width = w + 'px'
  roomImage.style.height = h + 'px'
}

const img = document.getElementById('room-img')
if (img.complete && img.naturalWidth) { fitRoom() } else { img.addEventListener('load', fitRoom) }
window.addEventListener('resize', fitRoom)
window.addEventListener('load', fitRoom)

// Re-fit and re-shimmer when returning via browser back (BFCache restore)
window.addEventListener('pageshow', e => {
  if (e.persisted) {
    fitRoom()
    initMobileShimmer()
  }
})

// ── PRELOAD OVERLAY GIFS ──────────────────
// Set srcs immediately so gifs are cached before first tap/hover (prevents black flash)
function preloadOverlays() {
  const mobile = isMobile()
  const overlays = [
    { id: 'vinyl-overlay',       desk: '/hotspot/vinyl.gif',       mob: '/hotspot/mobile/vinyl.gif' },
    { id: 'bulb-overlay',        desk: '/hotspot/bulb.gif',        mob: '/hotspot/mobile/bulb.gif' },
    { id: 'camera-overlay',      desk: '/hotspot/camera.gif',      mob: '/hotspot/mobile/camera.gif' },
    { id: 'frenchpress-overlay', desk: '/hotspot/frenchpress.gif', mob: '/hotspot/mobile/frenchpress.gif' },
    { id: 'bed-overlay',         desk: '/hotspot/bed.gif',         mob: '/hotspot/bed.gif' },
  ]
  overlays.forEach(({ id, desk, mob }) => {
    const el = document.getElementById(id)
    if (el) el.src = mobile ? mob : desk
  })
}
preloadOverlays()

// Hide all overlays and the revealed bottom link card
function hideAllOverlays() {
  ;['vinyl-overlay', 'bulb-overlay', 'camera-overlay', 'frenchpress-overlay', 'bed-overlay'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.classList.remove('active')
  })
  hideRevealedLink()
}

// ── VINYL HOTSPOT ─────────────────────────
const vinylHotspot = document.getElementById('vinyl-hotspot')
const vinylOverlay = document.getElementById('vinyl-overlay')

if (vinylHotspot && vinylOverlay) {
  function showVinyl() { vinylOverlay.classList.add('active') }
  function hideVinyl() { vinylOverlay.classList.remove('active') }

  // Desktop: hover
  vinylHotspot.addEventListener('mouseenter', () => {
    if (isMobile()) return
    showVinyl()
    window.cursorMorphTo('🎶')
    ttLabel.textContent = 'The Record'
    ttDesc.textContent = 'Music & Vibes'
    ttLink.textContent = 'View Records ↗'
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
    ttLink.textContent = 'View Records ↗'
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
  function showBulb() { bulbOverlay.classList.add('active') }
  function hideBulb() { bulbOverlay.classList.remove('active') }

  // Desktop: hover
  bulbHotspot.addEventListener('mouseenter', () => {
    if (isMobile()) return
    showBulb()
    window.cursorMorphTo('🪔')
    ttLabel.textContent = 'The Light'
    ttDesc.textContent = 'Get in Touch'
    ttLink.textContent = 'Leave a Note ↗'
    ttLink.href = 'contact.html'
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
      window.__softNavigate('contact.html')
    } else {
      window.location.href = 'contact.html'
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
        revealLink('The Light')
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
    window.cursorMorphTo('🪔')
    ttLabel.textContent = 'The Light'
    ttDesc.textContent = 'Get in Touch'
    ttLink.textContent = 'Leave a Note ↗'
    ttLink.href = 'contact.html'
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
  function showCamera() { cameraOverlay.classList.add('active') }
  function hideCamera() { cameraOverlay.classList.remove('active') }

  // Desktop: hover
  cameraHotspot.addEventListener('mouseenter', () => {
    if (isMobile()) return
    showCamera()
    window.cursorMorphTo('📷')
    ttLabel.textContent = 'The Fujifilm Camera'
    ttDesc.textContent = 'Photography'
    ttLink.textContent = 'View Work ↗'
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
    ttLink.textContent = 'View Work ↗'
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
  function showFrenchpress() { frenchpressOverlay.classList.add('active') }
  function hideFrenchpress() { frenchpressOverlay.classList.remove('active') }

  // Desktop: hover
  frenchpressHotspot.addEventListener('mouseenter', () => {
    if (isMobile()) return
    showFrenchpress()
    window.cursorMorphTo('☕')
    ttLabel.textContent = 'The French Press'
    ttDesc.textContent = 'Personal Aesthetics'
    ttLink.textContent = 'View Curation ↗'
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
    ttLink.textContent = 'View Curation ↗'
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
  function showBed() { bedOverlay.classList.add('active') }
  function hideBed() { bedOverlay.classList.remove('active') }

  // Desktop: hover
  bedHotspot.addEventListener('mouseenter', () => {
    if (isMobile()) return
    showBed()
    window.cursorMorphTo('🛏')
    ttLabel.textContent = 'The Bed'
    ttDesc.textContent = 'Who I Am'
    ttLink.textContent = 'About ↗'
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
    ttLink.textContent = 'About ↗'
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
  document.querySelectorAll('.zone').forEach((zone, i) => {
    zone.classList.add('shimmer')
    zone.style.setProperty('--shimmer-delay', `${(i * 0.35) % 2.4}s`)
  })
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