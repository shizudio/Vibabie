/* ─────────────────────────────────────────
   art-loader.js — first-visit intro, painted by the newest artwork
   ─────────────────────────────────────────

   Shows the latest painting full-bleed the first time someone arrives, holds
   it for at least two seconds, then fades to the site.

   WHICH PAINTING: artworks[0] of art-manifest-v2.json, always. Adding a new
   work to the head of that list makes it the intro, with nothing to wire up
   here — which is the whole point of reading it at runtime rather than
   hardcoding a path.

   THE DESKTOP CROP: the paintings are portrait and a desktop screen is not,
   so something has to be cut. object-fit: cover decides that by the box, and
   its default (centre) lands on the stem of a portrait flower rather than on
   the bloom. Each artwork may therefore carry an optional `loadingPosition`
   in the manifest, used verbatim as object-position on wide screens. Omitted,
   it falls back to INTRO_FALLBACK below, which is tuned for the upper-centre
   bloom that most of these paintings share. So a chosen crop is honoured, and
   a future painting with no crop set still looks deliberate.

   Narrow screens are portrait like the art, so they take the whole image and
   ignore loadingPosition entirely.

   NOT A GATE. A full-screen overlay that fails to leave is a broken site, so
   every path out is belt-and-braces: a hard failsafe dismisses it even if the
   manifest 404s, the image never decodes, or this script throws after mount.
   The overlay is also removed from the DOM afterwards rather than left
   invisible over the page.

   This is a CLASSIC script in <head>, deliberately — not type="module". A
   module is deferred, so the page would paint first and the intro would land
   on top of content the visitor had already begun reading. Running blocking
   in the head lets the first paint already be the intro. Keep it dependency
   free and ES5-safe for that reason.
*/
(function () {
  'use strict'

  var SEEN_KEY   = 'shiz-seen-intro'
  var MANIFEST   = '/art-manifest-v2.json'
  var MIN_MS     = 2000     // the floor Shina asked for
  var FAILSAFE   = 6000     // absolute ceiling, whatever else happens
  var DESKTOP_MIN= 768      // below this the art is shown whole
  var INTRO_FALLBACK = 'center 20%'

  function seen() {
    try { return localStorage.getItem(SEEN_KEY) === '1' } catch (e) { return false }
  }
  function remember() {
    try { localStorage.setItem(SEEN_KEY, '1') } catch (e) { /* private mode */ }
  }

  // Nothing to do on a return visit, and nothing to do if the visitor asked
  // for no motion AND has seen it — but a first-timer with reduced motion
  // still gets the art, just without the fade. The art is the content here,
  // not decoration, so suppressing it entirely would be the wrong call.
  if (seen()) return

  var started = Date.now()
  var done = false
  var el = null
  var failsafeTimer = null

  // Paint the ground immediately, before <body> exists, so the first frame is
  // the intro rather than a flash of the page. Removed the moment we finish.
  var style = document.createElement('style')
  style.id = 'intro-style'
  style.textContent =
    'html.intro-pending::before{content:"";position:fixed;inset:0;background:#FFFFFF;z-index:9998}' +
    'html.intro-pending{overflow:hidden}' +
    '.intro{position:fixed;inset:0;z-index:9999;background:#FFFFFF;opacity:1;' +
      'overflow:hidden;transition:opacity .6s ease}' +
    '.intro.is-out{opacity:0}' +
    '.intro img{width:100%;height:100%;object-fit:cover;object-position:center;' +
      'transform:scale(var(--intro-scale,1));' +
      'opacity:0;transition:opacity .5s ease;display:block}' +
    '.intro img.is-in{opacity:1}' +
    '@media (prefers-reduced-motion: reduce){' +
      '.intro,.intro img{transition:none}}'
  ;(document.head || document.documentElement).appendChild(style)
  document.documentElement.classList.add('intro-pending')

  function finish() {
    if (done) return
    done = true
    clearTimeout(failsafeTimer)
    remember()
    document.documentElement.classList.remove('intro-pending')
    if (!el) { if (style.parentNode) style.parentNode.removeChild(style); return }
    el.classList.add('is-out')
    var kill = function () {
      if (el && el.parentNode) el.parentNode.removeChild(el)
      if (style.parentNode) style.parentNode.removeChild(style)
      el = null
    }
    // Belt and braces: transitionend may never fire (reduced motion, a
    // backgrounded tab), so a timer removes it regardless.
    el.addEventListener('transitionend', kill, { once: true })
    setTimeout(kill, 900)
  }

  // Whatever happens below, the visitor gets their site back.
  failsafeTimer = setTimeout(finish, FAILSAFE)

  function holdThenFinish() {
    var elapsed = Date.now() - started
    setTimeout(finish, Math.max(0, MIN_MS - elapsed))
  }

  function mount(src, position, scale) {
    if (done) return
    var build = function () {
      if (done || !document.body) return
      el = document.createElement('div')
      el.className = 'intro'
      el.setAttribute('role', 'img')
      el.setAttribute('aria-label', 'Opening artwork')

      var img = document.createElement('img')
      img.alt = ''
      // Wide screens take the chosen crop; narrow ones are portrait like the
      // art itself, so they get the whole painting untouched.
      if (window.innerWidth >= DESKTOP_MIN) {
        if (position) img.style.objectPosition = position
        if (scale && scale !== 1) el.style.setProperty('--intro-scale', String(scale))
      }
      img.src = src
      el.appendChild(img)
      document.body.appendChild(el)

      var show = function () { img.classList.add('is-in'); holdThenFinish() }
      if (img.complete && img.naturalWidth > 0) show()
      else {
        img.addEventListener('load', show, { once: true })
        img.addEventListener('error', holdThenFinish, { once: true })
      }
    }
    if (document.body) build()
    else document.addEventListener('DOMContentLoaded', build, { once: true })
  }

  // Preload against the cache first so the <img> paints in one go.
  function load() {
    var req = new XMLHttpRequest()
    req.open('GET', MANIFEST, true)
    req.onload = function () {
      if (done) return
      var src = null, pos = null, scale = 1
      try {
        var data = JSON.parse(req.responseText)
        var first = data && data.artworks && data.artworks[0]
        if (first && first.src) {
          src = '/' + String(first.src).replace(/^\//, '')
          pos = first.loadingPosition || INTRO_FALLBACK
          scale = Number(first.loadingScale) || 1
        }
      } catch (e) { /* malformed manifest — fall through */ }
      if (src) mount(src, pos, scale)
      else holdThenFinish()
    }
    req.onerror = holdThenFinish
    req.send()
  }

  try { load() } catch (e) { holdThenFinish() }
})()
