/**
 * about-hero-lock.js — the landing heading stays no taller than the portrait.
 *
 * Side-by-side only (the hero stacks below 768px, and a stacked heading is
 * allowed to wrap). The ceiling is the frame's own 3:4 height: column width
 * × 4/3. That matches the portrait from 1024px up, where the frame is
 * aspect-ratio 3/4. Between 768 and 1023 the frame is stretched to the text
 * column, which is taller than 3/4, so the same ceiling still sits inside
 * the media.
 *
 * The heading keeps the column width while its lines fit. When another line
 * would pass the frame, this widens it and the extra runs out to the right.
 */

const intro = document.querySelector('.about-intro')
const h1 = document.querySelector('.about-intro-text .page-h1')
const media = document.getElementById('portraitFrame')
const sideBySide = window.matchMedia('(min-width: 768px)')

if (intro && h1 && media) {
  const contentHeight = () => {
    h1.style.maxHeight = 'none'
    const h = h1.getBoundingClientRect().height
    h1.style.maxHeight = ''
    return h
  }

  const fit = () => {
    h1.style.width = ''
    h1.style.whiteSpace = ''
    if (!sideBySide.matches) return

    const limit = media.getBoundingClientRect().width * 4 / 3
    intro.style.setProperty('--hero-media-h', `${limit}px`)
    if (contentHeight() <= limit + 0.5) return

    const narrow = h1.getBoundingClientRect().width
    /* Measured off-layout. A max-content width inside the column is clamped
       by the grid item, so the probe has to leave the column to learn how
       wide one line actually is. */
    const probe = h1.cloneNode(true)
    probe.style.cssText = 'position:absolute;left:0;top:0;width:max-content;max-width:none;max-height:none;white-space:nowrap;visibility:hidden;pointer-events:none;'
    document.body.appendChild(probe)
    const full = probe.getBoundingClientRect().width
    probe.remove()

    let lo = narrow
    let hi = Math.max(full, narrow)
    for (let i = 0; i < 16 && hi - lo > 0.5; i++) {
      const mid = (lo + hi) / 2
      h1.style.width = `${mid}px`
      if (contentHeight() <= limit + 0.5) hi = mid
      else lo = mid
    }
    h1.style.width = `${Math.ceil(hi)}px`
  }

  sideBySide.addEventListener('change', fit)
  window.addEventListener('resize', fit)
  document.fonts.ready.then(fit)
  document.fonts.addEventListener?.('loadingdone', fit)
  new MutationObserver(fit).observe(h1, { childList: true, characterData: true, subtree: true })
  fit()
}
