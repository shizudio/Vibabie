import { initLightbox } from './lightbox.js'
import { initArtRailWheel } from './about-art-wheel.js'

let lightboxOpen = null

function getLightbox() {
  const overlay = document.getElementById('art-lightbox')
  if (!overlay) return null
  if (overlay.dataset.lbReady) return lightboxOpen
  overlay.dataset.lbReady = '1'
  lightboxOpen = initLightbox(
    overlay,
    document.getElementById('art-lb-img'),
    document.getElementById('art-lb-caption'),
    document.getElementById('art-lb-close')
  ).open
  return lightboxOpen
}

/**
 * about-art.js — "Artworks" rail on the About page.
 *
 * Renders every painting in public/art-manifest-v2.json as a horizontally
 * scrolling strip between "Selected work" and the room. Deliberately a rail
 * and not a grid: the tiles above are a considered, finite selection, the
 * paintings are a body of work you browse — the different register is the
 * point. Scrolling is native (CSS scroll-snap in about.css); there is no drag
 * library and no animation loop here, so trackpad, touch, shift+wheel and
 * keyboard all work for free and it degrades to a plain overflow strip if the
 * CSS never lands.
 *
 * The one addition is about-art-wheel.js, which on desktop lets a vertical
 * wheel drive the rail sideways for a budgeted stretch before handing the
 * gesture back to the page. It is additive and self-limiting: every native
 * path above still works, and the feature is off for touch, narrow viewports
 * and reduced motion.
 *
 * The manifest also carries `beforeSrc` on some entries (a before/after state
 * of the same painting). Ignored on purpose: the flip belongs to the Art page,
 * where there is room to explain it. Here it would be an unlabelled surprise.
 *
 * Soft-nav safe: about.html is in router.js's SOFT_NAV_PAGES, so <main> gets
 * replaced and this module is re-executed (cache-busted) on every arrival. It
 * therefore looks the container up fresh on each run and marks that container
 * before awaiting, so a re-run against an already-populated rail is a no-op.
 */

// The head is one row of two peers — "Artworks" at 11, the "All art" link at
// 12 — picking up where the work tiles left off (hero 0–4, work head 5–6,
// work tiles 7–10). The cards then open at 13.
const STAGGER_START = 13

// ...but the wave is capped after the fourth card. Roughly four cards are on
// screen at once, so anything past that has already finished animating by the
// time it is scrolled into view; without the cap a longer manifest would push
// the room heading below into a multi-second delay for no visible gain.
const STAGGER_MAX_STEPS = 3


// ── Shared-element morph ──────────────────────────────────────────────────
// The delight on open is continuity, not spectacle: the painting the visitor
// clicked EXPANDS from its card into the lightbox, un-cropping as it grows —
// the 4:5 card crop relaxes into the work's true aspect because the flying
// box keeps object-fit: cover, and at the lightbox's aspect-true final size
// cover and contain are the same thing. A clone flies; the real lightbox
// image is hidden until the clone lands, then swaps in seamlessly.
//
// Box properties (left/top/width/height) rather than a transform: scaling a
// cover-cropped image with scaleX!=scaleY would stretch the painting mid-
// flight. One fixed element animating its box is cheap, and the reveal of the
// hidden edges of the painting IS the organic feel.
const MORPH_MS = 520
let morphing = false

function morphOpen(thumbImg, doOpen) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const from = thumbImg.getBoundingClientRect()
  doOpen()
  if (reduce || morphing || !from.width) return

  const overlay = document.getElementById('art-lightbox')
  const lbImg = document.getElementById('art-lb-img')
  if (!overlay || !lbImg) return

  morphing = true
  // Hide the real image (and its scale-in transition) until the clone lands.
  lbImg.style.transition = 'none'
  lbImg.style.opacity = '0'

  const cleanup = () => {
    morphing = false
    lbImg.style.opacity = ''
    // Restore the transition a frame later so clearing opacity doesn't animate.
    requestAnimationFrame(() => { lbImg.style.transition = '' })
  }

  const fly = () => {
    // The lightbox may have been closed before the image was ready.
    if (!overlay.classList.contains('open')) { cleanup(); return }
    const to = lbImg.getBoundingClientRect()
    if (!to.width) { cleanup(); return }

    const clone = document.createElement('div')
    clone.style.cssText =
      'position:fixed;overflow:hidden;z-index:9991;pointer-events:none;' +
      `left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;` +
      'border-radius:' + getComputedStyle(thumbImg.parentElement).borderRadius
    const img = document.createElement('img')
    img.src = thumbImg.currentSrc || thumbImg.src
    img.alt = ''
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block'
    clone.appendChild(img)
    document.body.appendChild(clone)

    const anim = clone.animate(
      [
        { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px', borderRadius: clone.style.borderRadius },
        { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px', borderRadius: '0px' },
      ],
      { duration: MORPH_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
    )
    anim.onfinish = anim.oncancel = () => { cleanup(); clone.remove() }
  }

  // The lightbox image shares the rail's src, so it is almost always cached —
  // but wait for a real decode before measuring its final box, with a timeout
  // so a slow network degrades to the plain fade rather than a hang.
  const timer = setTimeout(() => { cleanup() }, 900)
  const ready = lbImg.complete && lbImg.naturalWidth
    ? Promise.resolve()
    : new Promise(res => lbImg.addEventListener('load', res, { once: true }))
  ready.then(() => {
    clearTimeout(timer)
    requestAnimationFrame(fly)
  })
}

function buildCard(art, i) {
  const card = document.createElement('button')
  card.type = 'button'
  card.className = 'about-art-card fade-up'
  card.style.setProperty('--i', STAGGER_START + Math.min(i, STAGGER_MAX_STEPS))
  card.dataset.aboutArtInjected = 'true'
  // Image-only: the painting carries the card. Title and description live in
  // the lightbox instead, which is what a click opens.
  card.setAttribute('aria-label', `View ${art.title || 'artwork'}`)

  const thumb = document.createElement('div')
  thumb.className = 'about-art-thumb'

  const img = document.createElement('img')
  img.src = art.src
  img.alt = art.title || ''
  img.loading = 'lazy'
  img.decoding = 'async'
  thumb.appendChild(img)
  card.appendChild(thumb)

  card.addEventListener('click', () => {
    const open = getLightbox()
    if (!open) return
    const thumbImg = card.querySelector('img')
    morphOpen(thumbImg, () => open(art.src, art.description || art.title || ''))
  })

  return card
}

async function render() {
  const rail = document.getElementById('aboutArtRail')
  if (!rail) return

  // Desktop wheel-to-horizontal. Idempotent per element and safe against a rail
  // that is still empty — it re-measures at the start of every engagement — so
  // it goes in ahead of the population guard below, which means a re-run
  // against an already-populated rail still re-points the controller at it.
  initArtRailWheel(rail)

  // Claim this container synchronously, before any await — a second execution
  // of the module (double script tag, or a fast back/forward) then bails out
  // instead of racing to append a duplicate set of cards.
  if (rail.dataset.aboutArtState) return
  rail.dataset.aboutArtState = 'loading'

  let data
  try {
    // Same path art.js uses — resolves to /art-manifest-v2.json from any page.
    const resp = await fetch('art-manifest-v2.json')
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    data = await resp.json()
  } catch (err) {
    // Fail quietly: an empty section beats a broken page.
    console.warn('about-art: manifest unavailable', err)
    rail.dataset.aboutArtState = 'failed'
    return
  }

  // Tolerate both the {artworks, sketches} shape and a legacy flat array, in
  // case a stale copy is served from CDN cache. Sketches stay out: they are
  // studies, and the Art page frames them as such behind their own pile.
  const artworks = Array.isArray(data) ? data : (data && data.artworks)
  if (!Array.isArray(artworks)) {
    rail.dataset.aboutArtState = 'failed'
    return
  }

  // Nothing without an image in a showcase.
  const pieces = artworks.filter(a => a && a.src)

  if (!pieces.length) {
    rail.dataset.aboutArtState = 'empty'
    return
  }

  // A soft navigation may have swapped <main> out from under us mid-fetch.
  if (!rail.isConnected) return

  const frag = document.createDocumentFragment()
  pieces.forEach((art, i) => frag.appendChild(buildCard(art, i)))
  rail.appendChild(frag)
  rail.dataset.aboutArtState = 'ready'

  // Second, cheap call: the rail now has a real scrollWidth, so re-seed the
  // controller's cached geometry rather than leaving it to the first wheel tick.
  initArtRailWheel(rail)
}

render()
