/**
 * about-hero-lock.js — the landing heading never grows taller than the portrait.
 *
 * Side-by-side only (the hero stacks below 768px, and a stacked heading is
 * allowed to wrap). The ceiling is the frame's own 3:4 height: column width
 * x 4/3. That matches the portrait from 1024px up, where the frame is
 * aspect-ratio 3/4. Between 768 and 1023 the frame is stretched to the text
 * column, which is taller than 3/4, so the same ceiling still sits inside
 * the media.
 *
 * HEIGHT IS THE FIXED THING, WIDTH IS THE FLEXIBLE THING. In order:
 *
 *   1. The heading keeps the column width while its lines fit.
 *   2. When another line would pass the portrait, the line is widened and the
 *      extra runs out to the right, to the narrowest width that still fits.
 *   3. That width stops at the page margin, the same inset the nav uses. It
 *      never reaches the screen edge: an earlier version widened without a
 *      limit, which kept the height right and then cut the text off at the
 *      viewport (a doubled-length headline ran out to 2219px on a 1440px
 *      screen).
 *   4. Only when even the widest allowed line is still too tall does the type
 *      get smaller, a step at a time, down to a floor. This is what lets the
 *      height rule be a rule and not a hope. It costs the headline some size,
 *      so it is last, and it only ever happens for a headline far longer than
 *      anything the page carries today. The floor is 36px, the smallest the
 *      mobile heading already goes, so the site has already accepted that size
 *      as a heading. A first version stopped at 64% of the display size and a
 *      headline of about 340 characters still ran 47px past the portrait at
 *      1100px wide.
 *
 * The current headline fits in the column, so none of this runs for it: the
 * script measures, finds it fits, and leaves the heading exactly as written.
 */

const intro = document.querySelector('.about-intro')
const h1 = document.querySelector('.about-intro-text .page-h1')
const media = document.getElementById('portraitFrame')
const nav = document.querySelector('nav')
const sideBySide = window.matchMedia('(min-width: 768px)')

// Steps tried, largest first, as fractions of the heading's own size. The floor
// is in pixels because it is an absolute: the smallest size the site already
// sets a heading in (the mobile h1 bottoms out at 2.25rem).
const STEPS = [1, 0.94, 0.88, 0.82, 0.76, 0.7, 0.64, 0.58]
const FLOOR_PX = 36

if (intro && h1 && media) {
  const height = () => h1.getBoundingClientRect().height

  // The rightmost x a line may reach: the viewport less the page gutter. The
  // nav's own side padding is that gutter already resolved to pixels, which is
  // simpler and more honest than re-deriving a clamp() here.
  const rightLimit = () => {
    const gutter = nav ? parseFloat(getComputedStyle(nav).paddingRight) || 0 : 24
    return document.documentElement.clientWidth - gutter
  }

  const reset = () => {
    h1.style.width = ''
    h1.style.fontSize = ''
  }

  const fit = () => {
    reset()
    if (!sideBySide.matches) return

    const limit = media.getBoundingClientRect().width * 4 / 3
    if (height() <= limit + 0.5) return

    const box = h1.getBoundingClientRect()
    const narrow = box.width
    const available = Math.max(narrow, rightLimit() - box.left)

    const base = parseFloat(getComputedStyle(h1).fontSize)
    const sizes = [...new Set([...STEPS.map((s) => base * s).filter((px) => px > FLOOR_PX), Math.min(base, FLOOR_PX)])]

    for (const px of sizes) {
      h1.style.fontSize = px === base ? '' : `${px}px`
      h1.style.width = `${available}px`
      if (height() > limit + 0.5) continue   // too tall even at the widest line, shrink and retry

      // It fits at the widest line. Take the narrowest width that still does,
      // so the heading is only as wide as it has to be.
      let lo = narrow
      let hi = available
      for (let i = 0; i < 16 && hi - lo > 0.5; i++) {
        const mid = (lo + hi) / 2
        h1.style.width = `${mid}px`
        if (height() <= limit + 0.5) hi = mid
        else lo = mid
      }
      h1.style.width = `${Math.ceil(hi)}px`
      return
    }

    // Nothing fits, not even the floor size on the widest line. Leave it at
    // that: smallest, widest, and as short as it can be made. Reaching this
    // takes a headline of several hundred characters.
    h1.style.width = `${available}px`
  }

  // One measurement per frame however many events pile up. A resize fires
  // continuously, and each fit can run a search of layout reads.
  let frame = 0
  const schedule = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(fit)
  }

  sideBySide.addEventListener('change', schedule)
  window.addEventListener('resize', schedule)
  document.fonts.ready.then(schedule)
  document.fonts.addEventListener?.('loadingdone', schedule)
  // The heading is rewritten when the language switches, and fit changes only
  // style attributes, which this does not observe, so it cannot loop.
  new MutationObserver(schedule).observe(h1, { childList: true, characterData: true, subtree: true })
  fit()
}
