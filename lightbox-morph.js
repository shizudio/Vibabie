/**
 * lightbox-morph.js — shared-element transition for the art lightbox.
 *
 * The painting you click EXPANDS from its card into the lightbox, and when you
 * dismiss it, it flies back to the exact card it came from — its own place in
 * the carousel, wherever that has scrolled to. Continuity in both directions:
 * the thing you touched becomes the thing you asked for, and then goes home.
 *
 * Used by the About rail and the Art page (cards and the sketch grid); all of
 * them share the #art-lightbox markup.
 *
 * ── Interruptible ─────────────────────────────────────────────────────────
 * Any flight can be cancelled at any frame. Dismiss while the open is still
 * flying, or open another painting immediately after dismissing, and the
 * in-flight clone is dropped on the spot rather than finishing first. An
 * earlier version held a `morphing` flag that ignored input until the
 * animation ended, which is exactly the "rage-click does nothing" feeling
 * this is meant to avoid: a transition should never make the interface less
 * responsive than no transition at all.
 *
 * ── Why box properties, not transform ─────────────────────────────────────
 * The card crops its painting with object-fit: cover, and scaling a cropped
 * image with unequal X/Y factors stretches it mid-flight. Animating
 * left/top/width/height keeps every frame a true crop, so the card's tight
 * crop relaxes into the work's real aspect as it grows — the un-cropping IS
 * the effect.
 */

const MORPH_MS = 520
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

// The card this lightbox was opened from, so dismissing can return to it.
let origin = null
// The single in-flight clone, if any. Kept so it can always be cancelled.
let flight = null

function overlayEl() {
  return document.getElementById('art-lightbox')
}
function lbImgEl() {
  return document.getElementById('art-lb-img')
}

function reduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Drop any clone mid-flight. Called before starting a new one and whenever the
// visitor does something that makes the old flight meaningless.
function cancelFlight() {
  if (!flight) return
  const { node, anim } = flight
  flight = null
  try { anim.cancel() } catch (e) { /* already finished */ }
  node.remove()
}

function visible(rect) {
  return (
    rect.width > 0 &&
    rect.bottom > 0 &&
    rect.top < (window.innerHeight || 0) &&
    rect.right > 0 &&
    rect.left < (window.innerWidth || 0)
  )
}

// One flying copy of the painting, animated between two boxes.
function fly(src, from, to, radiusFrom, radiusTo, onDone) {
  cancelFlight()

  const node = document.createElement('div')
  node.style.cssText =
    'position:fixed;overflow:hidden;z-index:9991;pointer-events:none;' +
    `left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;` +
    `border-radius:${radiusFrom}`
  const img = document.createElement('img')
  img.src = src
  img.alt = ''
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block'
  node.appendChild(img)
  document.body.appendChild(node)

  const anim = node.animate(
    [
      { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, borderRadius: radiusFrom },
      { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, borderRadius: radiusTo },
    ],
    { duration: MORPH_MS, easing: EASE, fill: 'forwards' }
  )

  flight = { node, anim }
  anim.onfinish = () => {
    if (flight && flight.node === node) flight = null
    node.remove()
    if (onDone) onDone()
  }
  anim.oncancel = () => { if (onDone) onDone() }
}

/**
 * Open the lightbox with the painting expanding from `thumbImg`.
 * `doOpen` performs the actual lightbox open (from lightbox.js).
 */
export function morphOpen(thumbImg, doOpen) {
  origin = thumbImg || null
  doOpen()

  const from = thumbImg ? thumbImg.getBoundingClientRect() : null
  if (reduced() || !from || !from.width) return

  const overlay = overlayEl()
  const lbImg = lbImgEl()
  if (!overlay || !lbImg) return

  // Hide the real image until the clone lands, so there is never a double.
  lbImg.style.transition = 'none'
  lbImg.style.opacity = '0'

  const restore = () => {
    lbImg.style.opacity = ''
    requestAnimationFrame(() => { lbImg.style.transition = '' })
  }

  const radius = thumbImg.parentElement
    ? getComputedStyle(thumbImg.parentElement).borderRadius
    : '0px'

  // The lightbox image shares the card's src, so it is usually cached — but
  // wait for a real decode before measuring the landing box, with a timeout so
  // a slow network degrades to the plain fade rather than hanging.
  const timer = setTimeout(restore, 900)
  const ready = lbImg.complete && lbImg.naturalWidth
    ? Promise.resolve()
    : new Promise(res => lbImg.addEventListener('load', res, { once: true }))

  ready.then(() => {
    clearTimeout(timer)
    requestAnimationFrame(() => {
      if (!overlay.classList.contains('open')) { restore(); return }
      const to = lbImg.getBoundingClientRect()
      if (!to.width) { restore(); return }
      fly(thumbImg.currentSrc || thumbImg.src, from, to, radius, '0px', restore)
    })
  })
}

// ── Dismiss: fly back to the card it came from ─────────────────────────────
// Intercepted in the CAPTURE phase so this runs before lightbox.js's own close
// handlers, which are registered on the bubble phase. Once the clone is
// launched the real close is re-dispatched with a pass-through flag, so the
// backdrop fades at the same time as the painting flies home rather than
// snapping away after it.
function interceptClose(e, trigger) {
  const overlay = overlayEl()
  if (!overlay || !overlay.classList.contains('open')) return
  if (e.__morphPass) return

  const lbImg = lbImgEl()
  if (!lbImg || !origin || !origin.isConnected || reduced()) return

  const from = lbImg.getBoundingClientRect()
  const to = origin.getBoundingClientRect()
  // If the card has scrolled out of view there is no "spot" to return to —
  // let the plain fade handle it rather than flying at something off-screen.
  if (!from.width || !to.width || !visible(to)) return

  e.preventDefault()
  e.stopPropagation()

  const radius = origin.parentElement
    ? getComputedStyle(origin.parentElement).borderRadius
    : '0px'

  lbImg.style.transition = 'none'
  lbImg.style.opacity = '0'
  fly(lbImg.currentSrc || lbImg.src, from, to, '0px', radius, () => {
    lbImg.style.opacity = ''
    requestAnimationFrame(() => { lbImg.style.transition = '' })
  })

  origin = null

  // Now let the real close run, so the backdrop fades during the flight.
  const pass = new MouseEvent('click', { bubbles: true })
  pass.__morphPass = true
  trigger.dispatchEvent(pass)
}

document.addEventListener(
  'click',
  e => {
    const overlay = overlayEl()
    if (!overlay) return
    const closeBtn = document.getElementById('art-lb-close')
    if (closeBtn && closeBtn.contains(e.target)) return interceptClose(e, closeBtn)
    if (e.target === overlay) return interceptClose(e, closeBtn || overlay)
  },
  true
)

document.addEventListener(
  'keydown',
  e => {
    if (e.key !== 'Escape') return
    const closeBtn = document.getElementById('art-lb-close')
    if (closeBtn) interceptClose(e, closeBtn)
  },
  true
)
