/**
 * lightbox-morph.js — shared-element open transition for the art lightbox.
 *
 * Used by the About page rail and the Art page (cards and sketch grid): the
 * clicked image expands from its exact position into the lightbox. Extracted
 * so all call sites share one implementation; both pages use the same
 * #art-lightbox / #art-lb-img markup.
 */

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

export function morphOpen(thumbImg, doOpen) {
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

