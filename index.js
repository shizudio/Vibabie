/* ─────────────────────────────────────────
   index.js — Home page scripts
   ───────────────────────────────────────── */

// ── LOADER ───────────────────────────────
const loader = document.getElementById('loader')
const loaderNum = document.getElementById('loader-num')
const stage = document.getElementById('stage')
const hangingString = document.getElementById('hanging-string')

let count = 0
const counter = setInterval(() => {
  count += 1
  loaderNum.textContent = count
  if (count === 100) {
    clearInterval(counter)
    setTimeout(() => {
      loader.classList.add('hidden')
      stage.classList.add('visible')
      hangingString.classList.add('visible')
    }, 500)
  }
}, 18)

// ── FIT IMAGE TO SCREEN ───────────────────
function fitRoom() {
  const img = document.getElementById('room-img')
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
  const roomImage = document.getElementById('room-image')
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

document.querySelectorAll('.zone').forEach(zone => {
  zone.addEventListener('mouseenter', () => {
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
    cursor.className = 'cursor default-cursor'
    cursor.textContent = ''
    tooltip.classList.remove('visible')
  })

  zone.addEventListener('click', () => {
    if (zone.dataset.external === 'true') {
      window.open(zone.dataset.href, '_blank')
    } else {
      window.location.href = zone.dataset.href
    }
  })
})