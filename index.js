/* ─────────────────────────────────────────
   index.js — Home page scripts
   ───────────────────────────────────────── */

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
      }, 800)
    }
  }, 100)
}

// ── FIT IMAGE TO SCREEN ───────────────────
function fitRoom() {
  const isMobile = window.matchMedia('(max-width: 767px)').matches
  const img = document.getElementById('room-img')
  const roomImage = document.getElementById('room-image')

  if (isMobile) {
    // Let CSS handle sizing on mobile
    img.style.width = ''
    img.style.height = ''
    roomImage.style.width = ''
    roomImage.style.height = ''
    return
  }

  const padding = 64 + 32 + 3
  const headerFooter = 120
  const maxW = window.innerWidth - padding - 40
  const maxH = window.innerHeight - headerFooter - padding
  const naturalW = img.naturalWidth || 1440
  const naturalH = img.naturalHeight || 856
  const ratio = naturalW / naturalH
  let w = maxW, h = w / ratio
  if (h > maxH) { h = maxH; w = h * ratio }
  img.style.width = w + 'px'
  img.style.height = h + 'px'
  roomImage.style.width = w + 'px'
  roomImage.style.height = h + 'px'
}

const img = document.getElementById('room-img')
if (img.complete) { fitRoom() } else { img.addEventListener('load', fitRoom) }
window.addEventListener('resize', fitRoom)

// ── BULB HOTSPOT ──────────────────────────
const bulbHotspot = document.getElementById('bulb-hotspot')
const bulbOverlay = document.getElementById('bulb-overlay')

if (bulbHotspot && bulbOverlay) {
  function showBulb() {
    bulbOverlay.src = '/hotspot/bulb.gif'
    bulbOverlay.classList.add('active')
  }
  function hideBulb() {
    bulbOverlay.classList.remove('active')
  }

  // Desktop: hover
  bulbHotspot.addEventListener('mouseenter', () => {
    if (isMobile()) return
    showBulb()
    window.cursorMorphTo('🪔')
  })
  bulbHotspot.addEventListener('mouseleave', () => {
    if (isMobile()) return
    hideBulb()
    window.cursorMorphBack()
  })

  function navigateBulb() {
    if (window.__softNavigate) {
      window.__softNavigate('contact.html')
    } else {
      window.location.href = 'contact.html'
    }
  }

  // Hotspot click: navigate on desktop, toggle on mobile
  bulbHotspot.addEventListener('click', () => {
    if (isMobile()) {
      if (bulbOverlay.classList.contains('active')) {
        hideBulb()
      } else {
        showBulb()
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
  })
  bulbOverlay.addEventListener('mouseleave', () => {
    if (isMobile()) return
    hideBulb()
    window.cursorMorphBack()
  })
}

// ── CAMERA HOTSPOT ────────────────────────
const cameraHotspot = document.getElementById('camera-hotspot')
const cameraOverlay = document.getElementById('camera-overlay')

if (cameraHotspot && cameraOverlay) {
  function showCamera() {
    cameraOverlay.src = '/hotspot/camera.gif'
    cameraOverlay.classList.add('active')
  }
  function hideCamera() {
    cameraOverlay.classList.remove('active')
  }

  // Desktop: hover
  cameraHotspot.addEventListener('mouseenter', () => {
    if (isMobile()) return
    showCamera()
    window.cursorMorphTo('📷')
  })
  cameraHotspot.addEventListener('mouseleave', () => {
    if (isMobile()) return
    hideCamera()
    window.cursorMorphBack()
  })

  function navigateCamera() {
    if (window.__softNavigate) {
      window.__softNavigate('photography.html')
    } else {
      window.location.href = 'photography.html'
    }
  }

  // Hotspot click: navigate on desktop, toggle on mobile
  cameraHotspot.addEventListener('click', () => {
    if (isMobile()) {
      if (cameraOverlay.classList.contains('active')) {
        hideCamera()
      } else {
        showCamera()
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
  })
  cameraOverlay.addEventListener('mouseleave', () => {
    if (isMobile()) return
    hideCamera()
    window.cursorMorphBack()
  })
}

// ── BED HOTSPOT ───────────────────────────
const bedHotspot = document.getElementById('bed-hotspot')
const bedOverlay = document.getElementById('bed-overlay')

if (bedHotspot && bedOverlay) {
  function showBed() {
    bedOverlay.src = '/hotspot/bed.gif'
    bedOverlay.classList.add('active')
  }
  function hideBed() {
    bedOverlay.classList.remove('active')
  }

  // Desktop: hover
  bedHotspot.addEventListener('mouseenter', () => {
    if (isMobile()) return
    showBed()
    window.cursorMorphTo('🛏')
  })
  bedHotspot.addEventListener('mouseleave', () => {
    if (isMobile()) return
    hideBed()
    window.cursorMorphBack()
  })

  function navigateBed() {
    if (window.__softNavigate) {
      window.__softNavigate('about.html')
    } else {
      window.location.href = 'about.html'
    }
  }

  // Hotspot click: navigate on desktop, toggle on mobile
  bedHotspot.addEventListener('click', () => {
    if (isMobile()) {
      if (bedOverlay.classList.contains('active')) {
        hideBed()
      } else {
        showBed()
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
  })
  bedOverlay.addEventListener('mouseleave', () => {
    if (isMobile()) return
    hideBed()
    window.cursorMorphBack()
  })
}

// ── ZONE INTERACTIONS ─────────────────────
const tooltip = document.getElementById('tooltip')
const ttLabel = document.getElementById('tt-label')
const ttDesc = document.getElementById('tt-desc')
const ttLink = document.getElementById('tt-link')

// Build a map of zone label → matching mobile link
const mobileLinks = document.querySelectorAll('.mobile-link')
const labelToLink = {}
mobileLinks.forEach(link => {
  const label = link.querySelector('.mobile-link-label')
  if (label) labelToLink[label.textContent.trim()] = link
})

// Track which zone was last tapped (for tap-again-to-navigate)
let lastTappedZone = null
const isMobile = () => window.matchMedia('(max-width: 767px)').matches

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
      // Mobile: first tap highlights button, second tap navigates
      const matchingLink = labelToLink[zone.dataset.label]

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

      // First tap → highlight the matching button
      lastTappedZone = zone
      if (matchingLink) {
        // Remove glow from all links first
        mobileLinks.forEach(l => l.classList.remove('glow'))
        // Trigger reflow so animation restarts
        void matchingLink.offsetWidth
        matchingLink.classList.add('glow')
        // Scroll button into view
        matchingLink.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
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