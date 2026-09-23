/**
 * about-bio.js — the "About Shina" toggle on the landing hero.
 *
 * The hero has two faces (see .about-deck in about.css): the positioning line
 * with the Based in / Working in / Currently row, and the longer bio. This
 * decides which one is showing. That is all it decides.
 *
 * It used to measure the incoming face and animate the deck's height to match,
 * because the two faces are different heights and CSS cannot transition to
 * `height: auto`. That was the wrong shape. A deck that changes height pushes
 * everything under it: at a 650px window "Selected work" jumped 133px on every
 * toggle, and the page below resized. The fix lives in CSS now — both faces
 * share one grid cell, so the deck is permanently as tall as the taller of
 * them and nothing downstream can move.
 *
 * So there is no height code here any more, and no layout-triggering animation
 * anywhere in the feature. The slide and fade are transform and opacity, which
 * stay on the compositor.
 *
 * Soft-nav safe: about.html is in router.js's SOFT_NAV_PAGES, so <main> is
 * replaced and page modules re-execute cache-busted on every arrival. The
 * controller lives once per document on window.__shizAboutBio; later runs only
 * re-attach to the new elements. Listeners are attached per-element, not to
 * document, so nothing stacks.
 */

function controller() {
  const s = { deck: null, intro: null, bio: null, btn: null, pages: null, dots: null }

  /**
   * The mobile bio is two pages side by side in a scroll-snap container. The
   * browser owns the swipe, the inertia and the snap — this only reads where
   * it landed so the right dot lights up. Passive, and never calls
   * preventDefault or scrollTo during a gesture.
   */
  function syncDots() {
    if (!s.pages || !s.dots) return
    const page = s.pages.firstElementChild
    if (!page) return
    const width = page.getBoundingClientRect().width
    if (!width) return
    const i = Math.round(s.pages.scrollLeft / width)
    ;[...s.dots.children].forEach((d, n) => d.classList.toggle('is-on', n === i))
  }

  /**
   * Closing the bio rewinds it. Leaving it on page two means the next visitor
   * to open it lands mid-sentence with no indication they have missed a page.
   * `auto` rather than the CSS `smooth`, so the rewind happens while the face
   * is hidden instead of animating on its way back in.
   */
  function rewindPages() {
    if (!s.pages) return
    const prev = s.pages.style.scrollBehavior
    s.pages.style.scrollBehavior = 'auto'
    s.pages.scrollLeft = 0
    s.pages.style.scrollBehavior = prev
    syncDots()
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

    // Which way the pair travels. Set before the class swap so the parked
    // position of the outgoing face is already correct when it leaves. Under
    // prefers-reduced-motion the CSS zeroes both transitions, so the same two
    // lines below produce an instant swap with no special case here.
    s.deck.dataset.direction = toBio ? 'forward' : 'back'

    outgoing.classList.remove('is-active')
    incoming.classList.add('is-active')

    if (!toBio) rewindPages()
  }

  function onClick() {
    show(s.bio.classList.contains('is-active') ? 'intro' : 'bio')
  }

  return {
    attach(deck, intro, bio, btn, pages, dots) {
      s.pages = pages
      s.dots = dots
      if (pages) pages.addEventListener('scroll', syncDots, { passive: true })
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
      deck.removeAttribute('data-direction')
      rewindPages()
    },
  }
}

export function initAboutBio() {
  const deck = document.getElementById('aboutDeck')
  const intro = document.getElementById('aboutFaceIntro')
  const bio = document.getElementById('aboutFaceBio')
  const btn = document.getElementById('aboutToggle')
  // Optional: the pager and its dots only exist on this page's bio face, and
  // the toggle must keep working if either is ever removed.
  const pages = document.getElementById('aboutBioPages')
  const dots = document.getElementById('aboutBioDots')
  if (!deck || !intro || !bio || !btn) return
  if (btn.dataset.aboutBioBound) return

  if (!window.__shizAboutBio) window.__shizAboutBio = controller()
  window.__shizAboutBio.attach(deck, intro, bio, btn, pages, dots)
}

initAboutBio()
