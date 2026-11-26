/**
 * about-hero-lock.js — the landing heading stays inside the portrait.
 *
 * TWO RULES, both measured from where things actually are on screen:
 *
 *   HEIGHT. The heading's top is never above the portrait's top, and its bottom
 *   is never below the portrait's bottom.
 *
 *   WIDTH. The heading never runs past the right edge of the "About Shina"
 *   button, which is the right edge of the text column. If it would, the type
 *   gets smaller instead.
 *
 * An earlier version checked only that the heading was SHORTER than the
 * portrait, and passed while the page was visibly wrong. The heading and the
 * portrait are centred on each other, so a heading that is merely tall for its
 * slot starts higher than the photo does: 292px of heading against a 400px
 * portrait still began 54px above the top of the photo. Height was the wrong
 * question. Position is the right one.
 *
 * Side-by-side only (the hero stacks below 768px, and a stacked heading is
 * allowed to wrap). Between 768 and 1023px the frame is stretched to the text
 * column, so the two already start together and this finds nothing to do.
 *
 * THE LEVERS, in order. Stop at the first that satisfies the rules:
 *
 *   1. WIDEN the heading, to the narrowest width that fits, but never past the
 *      button's right edge. The heading starts out exactly that wide, so this
 *      only has room to act where the button sits further right than the column.
 *      An earlier version let the line run out to the page margin; on the real
 *      headline that put its right edge 160px beyond the button.
 *   2. SHRINK the type a little, a step at a time, with the line at its widest.
 *      Only down to 80%: a headline that has to be much smaller to fit has
 *      stopped being the headline, and the portrait can take the difference.
 *   3. GROW THE PORTRAIT taller, to the smallest height that contains the
 *      heading. The photo is cropped a little more, as it always is. This is the
 *      last lever and it has no limit, so the rule has no exception however long
 *      the heading is. (An earlier version shrank the type to 36px first. On the
 *      real headline that meant 70% type at 1024px wide, to avoid growing the
 *      portrait by a few dozen pixels, which is the wrong trade for a hero.)
 *
 * Whatever already satisfies the rule is left alone: the script measures, finds
 * it fits, and changes nothing.
 */

const intro = document.querySelector('.about-intro')
const h1 = document.querySelector('.about-intro-text .page-h1')
const media = document.getElementById('portraitFrame')
const nav = document.querySelector('nav')
const toggle = document.getElementById('aboutToggle')
const sideBySide = window.matchMedia('(min-width: 768px)')

// Sizes tried, largest first, as fractions of the heading's own size. 0.8 is the
// smallest it will go; past that the portrait grows instead.
const STEPS = [1, 0.95, 0.9, 0.85, 0.8]

if (intro && h1 && media) {
  // Both rules at once. Inside the portrait's vertical span, and not past the
  // button's edge, to half a pixel. scrollWidth catches a single word too long
  // for the line: it overflows the heading's own box, so the box's edge looks
  // fine while the text is not.
  const inside = () => {
    const m = media.getBoundingClientRect()
    const h = h1.getBoundingClientRect()
    const vertical = h.top >= m.top - 0.5 && h.bottom <= m.bottom + 0.5
    const horizontal = h.right <= rightLimit() + 0.5 && h1.scrollWidth <= h1.clientWidth + 1
    return vertical && horizontal
  }

  // The rightmost x the heading may reach: the right edge of "About Shina". The
  // toggle keeps a fixed minimum width, so the edge does not move when its label
  // changes to "Back". If the button is ever missing, fall back to the page
  // margin, which is the nav's own side padding already resolved to pixels.
  const rightLimit = () => {
    if (toggle) return toggle.getBoundingClientRect().right
    const gutter = nav ? parseFloat(getComputedStyle(nav).paddingRight) || 0 : 24
    return document.documentElement.clientWidth - gutter
  }

  const reset = () => {
    h1.style.width = ''
    h1.style.fontSize = ''
    media.style.aspectRatio = ''
  }

  const fit = () => {
    reset()
    if (!sideBySide.matches) return
    if (inside()) return

    const box = h1.getBoundingClientRect()
    const narrow = box.width
    const available = Math.max(narrow, rightLimit() - box.left)

    const base = parseFloat(getComputedStyle(h1).fontSize)
    const sizes = STEPS.map((s) => base * s)

    // Levers 1 and 2: the widest line at each size, largest size first.
    for (const px of sizes) {
      h1.style.fontSize = px === base ? '' : `${px}px`
      h1.style.width = `${available}px`
      if (!inside()) continue

      // It fits at the widest line. Take the narrowest width that still does,
      // so the heading is only as wide as it has to be. Wider only ever helps
      // (fewer lines, a shorter heading), so a binary search is sound.
      let lo = narrow
      let hi = available
      for (let i = 0; i < 16 && hi - lo > 0.5; i++) {
        const mid = (lo + hi) / 2
        h1.style.width = `${mid}px`
        if (inside()) hi = mid
        else lo = mid
      }
      h1.style.width = `${Math.ceil(hi)}px`
      return
    }

    // Lever 3: the smallest, widest heading still pokes out, so the portrait
    // grows to contain it. Both are centred on the same line, so a taller
    // portrait moves its top up and its bottom down by the same amount, and the
    // rule depends only on how tall it is: a binary search again.
    h1.style.width = `${available}px`
    const w = media.getBoundingClientRect().width
    const setHeight = (px) => { media.style.aspectRatio = `${w} / ${px}` }
    let lo = media.getBoundingClientRect().height
    let hi = Math.max(lo * 2, h1.getBoundingClientRect().height * 2)
    setHeight(hi)
    for (let i = 0; i < 6 && !inside(); i++) { lo = hi; hi *= 2; setHeight(hi) }
    for (let i = 0; i < 14 && hi - lo > 1; i++) {
      const mid = (lo + hi) / 2
      setHeight(mid)
      if (inside()) hi = mid
      else lo = mid
    }
    setHeight(Math.ceil(hi))
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
