/* ─────────────────────────────────────────
   index.js — Home page scripts
   ───────────────────────────────────────── */

// ── LOADER ───────────────────────────────
const loader = document.getElementById('loader')
const loaderNum = document.getElementById('loader-num')
const loaderVideo = document.getElementById('loader-video')
const stage = document.getElementById('stage')
const hangingString = document.getElementById('hanging-string')

// Start video immediately
if (loaderVideo) {
  loaderVideo.play().catch(() => {}) // silent catch for browsers that block autoplay
}

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

// ── FIT IMAGE TO SCREEN ───────────────────
function fitRoom() {
  const isMobile = window.matchMedia('(max-width: 768px)').matches
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
const isMobile = () => window.matchMedia('(max-width: 768px)').matches

document.querySelectorAll('.zone').forEach(zone => {
  // Desktop: hover + click
  zone.addEventListener('mouseenter', () => {
    if (isMobile()) return
    cursor.className = 'cursor emoji-cursor'
    cursor.textContent = zone.dataset.emoji
    ttLabel.textContent = zone.dataset.label
    ttDesc.textContent = zone.dataset.desc
    ttLink.textContent = zone.dataset.linkText
    ttLink.href = zone.dataset.href
    ttLink.target = zone.dataset.external === 'true' ? '_blank' : '_self'
    tooltip.classList.add('visible')
  })

  zone.addEventListener('mouseleave', () => {
    if (isMobile()) return
    cursor.className = 'cursor default-cursor'
    cursor.textContent = '♥'
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
          window.location.href = zone.dataset.href
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
        window.location.href = zone.dataset.href
      }
    }
  })
})