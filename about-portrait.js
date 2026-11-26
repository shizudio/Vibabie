/**
 * about-portrait.js — the profile media on the About landing, and its archive.
 *
 * The portrait used to be a hardcoded <img> plus a hover <video>. It now comes
 * from public/portrait-manifest.json, entry 0, so changing the photo is a
 * content edit (see add-portrait.js) rather than a markup edit.
 *
 * Clicking it opens the archive: every portrait that has ever been on the page,
 * newest first, Telegram-style. Segment bars across the top for position, tap
 * the left or right half to move, arrow keys and swipe as well.
 *
 * PROGRESSIVE, NOT REQUIRED. The markup still carries the current portrait as
 * written HTML, so the face is on the page before this module runs and stays
 * there if the manifest never loads. All this does is replace the source when
 * the manifest says something newer, and add the archive behind a click. A
 * failed fetch costs the gallery, never the portrait.
 *
 * The hover-to-play video wiring lives in script.js and binds to .portrait-vid
 * on load, so when a new entry has no video the element is left in place with
 * no src rather than removed, and script.js keeps working untouched.
 */

const MANIFEST = '/portrait-manifest.json'

let shots = []
let i = 0
let overlay = null
let onKey = null
let archiveTrigger = null
let previousOverflow = ''

const el = (tag, cls, text) => {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

/* ── Archive ────────────────────────────────────────────────────────────── */

function render() {
  if (!overlay) return
  const shot = shots[i]
  const img = overlay.querySelector('.pg-img')
  img.src = shot.src
  img.alt = shot.alt || `Profile picture from ${shot.date || 'an earlier time'}`

  const meta = overlay.querySelector('.pg-meta')
  // Entry 0 is live right now; everything else is history, and saying which
  // is the whole point of showing them in order.
  meta.textContent = i === 0
    ? (shot.date ? `Current · since ${shot.date}` : 'Current')
    : (shot.date || '')

  overlay.querySelectorAll('.pg-seg').forEach((s, n) => {
    s.classList.toggle('is-on', n === i)
  })
  overlay.querySelector('.pg-prev').disabled = i === 0
  overlay.querySelector('.pg-next').disabled = i === shots.length - 1
}

function go(step) {
  const next = i + step
  if (next < 0 || next >= shots.length) return
  const focused = document.activeElement
  i = next
  render()
  if (focused?.disabled) overlay.querySelector('.pg-close').focus({ preventScroll: true })
}

function close() {
  if (!overlay) return
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = previousOverflow
  overlay.remove()
  overlay = null
  if (archiveTrigger?.isConnected) archiveTrigger.focus({ preventScroll: true })
}

function open(start = 0) {
  if (overlay || !shots.length) return
  i = Math.max(0, Math.min(start, shots.length - 1))
  archiveTrigger = document.activeElement
  previousOverflow = document.body.style.overflow

  overlay = el('div', 'pg-overlay')
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', 'Profile picture archive')

  const segs = el('div', 'pg-segs')
  shots.forEach(() => segs.appendChild(el('span', 'pg-seg')))
  overlay.appendChild(segs)

  const closeBtn = el('button', 'pg-close')
  closeBtn.type = 'button'
  closeBtn.setAttribute('aria-label', 'Close')
  closeBtn.innerHTML = '&#x2715;'
  overlay.appendChild(closeBtn)

  const stage = el('div', 'pg-stage')
  const img = el('img', 'pg-img')
  img.decoding = 'async'
  stage.appendChild(img)
  overlay.appendChild(stage)

  overlay.appendChild(el('p', 'pg-meta'))

  // Explicit navigation leaves the black background free to dismiss the viewer.
  const prev = el('button', 'pg-prev')
  prev.type = 'button'; prev.setAttribute('aria-label', 'Previous picture'); prev.textContent = 'Previous'
  const next = el('button', 'pg-next')
  next.type = 'button'; next.setAttribute('aria-label', 'Next picture'); next.textContent = 'Next'
  overlay.appendChild(prev)
  overlay.appendChild(next)

  prev.addEventListener('click', (e) => { e.stopPropagation(); go(-1) })
  next.addEventListener('click', (e) => { e.stopPropagation(); go(1) })
  closeBtn.addEventListener('click', close)
  overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target === stage) close() })

  onKey = (e) => {
    if (e.key === 'Escape') close()
    else if (e.key === 'ArrowLeft') go(-1)
    else if (e.key === 'ArrowRight') go(1)
    else if (e.key === 'Tab') {
      const controls = [...overlay.querySelectorAll('button:not(:disabled)')]
      const first = controls[0], last = controls[controls.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }
  document.addEventListener('keydown', onKey)

  // Touch: a horizontal swipe moves, anything shorter is treated as a tap and
  // left to the buttons underneath.
  let x0 = null
  stage.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX }, { passive: true })
  stage.addEventListener('touchend', (e) => {
    if (x0 == null) return
    const dx = e.changedTouches[0].clientX - x0
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
    x0 = null
  }, { passive: true })

  document.body.style.overflow = 'hidden'
  document.body.appendChild(overlay)
  render()
  closeBtn.focus()
}

/* ── Current portrait ───────────────────────────────────────────────────── */

async function init() {
  const frame = document.getElementById('portraitFrame')
  if (!frame || frame.dataset.portraitReady) return
  frame.dataset.portraitReady = '1'

  try {
    const res = await fetch(MANIFEST, { cache: 'no-cache' })
    if (res.ok) shots = (await res.json()).portraits || []
  } catch (e) { /* keep whatever the markup already shows */ }

  if (!shots.length) return

  const current = shots[0]
  const img = frame.querySelector('.portrait-img')
  const vid = frame.querySelector('.portrait-vid')
  // The build normally wrote the current portrait into the HTML already (see
  // vite-plugin-portrait.js), so in the usual case there is nothing to do here.
  // The comparison is the point: re-assigning an identical src makes the
  // browser re-run the image load, which is itself a chance to repaint, and
  // this module exists to avoid exactly that flash. It only steps in when the
  // markup is stale, for instance when the page was served before a new
  // portrait was deployed.
  const sameFile = (el, want) => !!want && (el.getAttribute('src') || '') === want
  if (img && current.src && !sameFile(img, current.src)) {
    img.src = current.src
    if (current.alt) img.alt = current.alt
  }
  if (vid) {
    // Left in the DOM either way: script.js binds the hover handler to it on
    // load, and removing it would break that for every later entry too.
    if (current.video) { if (!sameFile(vid, current.video)) vid.src = current.video }
    else if (vid.hasAttribute('src')) vid.removeAttribute('src')
  }

  // Only worth opening if there is something behind the current one.
  if (shots.length < 2) return

  frame.setAttribute('role', 'button')
  frame.setAttribute('tabindex', '0')
  frame.setAttribute('aria-label', `Profile picture archive, ${shots.length} pictures`)
  frame.addEventListener('click', () => open(0))
  frame.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(0) }
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}

window.__shizPortrait = { open, close }
