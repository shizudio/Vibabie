/**
 * about-bio.js — the "About Shina" toggle on the landing hero.
 *
 * The hero has two faces (see .about-deck in about.css): the positioning line
 * with the Based in / Working in / Currently row, and the longer bio. This
 * slides between them.
 *
 * What CSS owns: the slide and the fade. Both are transform + opacity, so they
 * stay on the compositor.
 *
 * What this owns: which face is active, and the deck's height. CSS cannot
 * transition to `height: auto`, and the two faces differ by several hundred
 * pixels — letting the height snap while the text slides looked broken at every
 * duration tried. So the incoming face is measured before the swap, the deck is
 * given that height explicitly, and the height is released back to `auto` once
 * the transition lands. Releasing it matters: a hard-coded height would not
 * survive a window resize or a late-loading font.
 *
 * Soft-nav safe: about.html is in router.js's SOFT_NAV_PAGES, so <main> is
 * replaced and page modules re-execute cache-busted on every arrival. The
 * controller lives once per document on window.__shizAboutBio; later runs only
 * re-attach to the new elements. Listeners are attached per-element, not to
 * document, so nothing stacks.
 */

// Matches the transform duration in about.css. If you change one, change both.
const SLIDE_MS = 360

const reduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function controller() {
  const s = { deck: null, intro: null, bio: null, btn: null, timer: 0 }

  /**
   * Measure a face that is currently out of flow. It cannot simply be read —
   * an inactive face is position:absolute and visibility:hidden, so its height
   * is already correct, but only if it has the width it will have when active.
   * It does: the rule pins left:0 and right:0 to the deck.
   */
  function heightOf(face) {
    return face.getBoundingClientRect().height
  }

  function release() {
    if (!s.deck) return
    s.deck.style.height = 'auto'
    s.deck.removeAttribute('data-direction')
  }

  function show(next) {
    if (!s.deck || !s.intro || !s.bio) return

    const toBio = next === 'bio'
    const incoming = toBio ? s.bio : s.intro
    const outgoing = toBio ? s.intro : s.bio

    if (incoming.classList.contains('is-active')) return

    s.btn.setAttribute('aria-expanded', String(toBio))
    s.btn.textContent = toBio
      ? s.btn.dataset.labelClose || 'Back'
      : s.btn.dataset.labelOpen || 'About Shina'

    if (reduced()) {
      outgoing.classList.remove('is-active')
      incoming.classList.add('is-active')
      release()
      return
    }

    // Which way the pair travels. Set before the class swap so the parked
    // position of the outgoing face is already correct when it leaves.
    s.deck.dataset.direction = toBio ? 'forward' : 'back'

    // Lock the current height so the transition has a start value to animate
    // from, and commit it before anything else changes.
    const from = s.deck.getBoundingClientRect().height
    s.deck.style.height = from + 'px'

    // Force the locked height to be committed before the new one is set,
    // otherwise the browser collapses both writes into one and nothing moves.
    void s.deck.offsetHeight

    outgoing.classList.remove('is-active')
    incoming.classList.add('is-active')

    // Measure AFTER the swap, not before. The bio view drops the portrait and
    // goes two-column, and both of those hang off `.is-active` via :has() — so
    // before the swap the bio still measures at the narrow single-column width
    // and the height would animate to a number that is never real.
    s.deck.style.height = heightOf(incoming) + 'px'

    // Hand the height back to the document once the slide has landed, so the
    // deck can respond to resizes and reflows on its own again.
    clearTimeout(s.timer)
    s.timer = setTimeout(release, SLIDE_MS + 40)
  }

  function onClick() {
    show(s.bio.classList.contains('is-active') ? 'intro' : 'bio')
  }

  return {
    attach(deck, intro, bio, btn) {
      s.deck = deck
      s.intro = intro
      s.bio = bio
      s.btn = btn
      btn.dataset.aboutBioBound = '1'
      btn.addEventListener('click', onClick)

      // A soft navigation back to this page should not land on the bio.
      bio.classList.remove('is-active')
      intro.classList.add('is-active')
      btn.setAttribute('aria-expanded', 'false')
      btn.textContent = btn.dataset.labelOpen || 'About Shina'
      release()
    },
  }
}

export function initAboutBio() {
  const deck = document.getElementById('aboutDeck')
  const intro = document.getElementById('aboutFaceIntro')
  const bio = document.getElementById('aboutFaceBio')
  const btn = document.getElementById('aboutToggle')
  if (!deck || !intro || !bio || !btn) return
  if (btn.dataset.aboutBioBound) return

  if (!window.__shizAboutBio) window.__shizAboutBio = controller()
  window.__shizAboutBio.attach(deck, intro, bio, btn)
}

initAboutBio()
