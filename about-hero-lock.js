/**
 * about-hero-lock.js — the landing heading stays inside the portrait.
 *
 * Side-by-side only (the hero stacks below 768px, and a stacked heading is
 * allowed to wrap). From 1024px up the intro face is centred in a deck sized
 * to the bio, so a heading can be shorter than the frame and still start
 * above it. The words have to start at the frame and end above its bottom.
 *
 * First the heading is shifted down onto the frame. If it still hangs past
 * the bottom, it widens and the extra runs right, stopping at the viewport
 * because the page clips horizontal overflow.
 */

const intro = document.querySelector('.about-intro')
const h1 = document.querySelector('.about-intro-text .page-h1')
const media = document.getElementById('portraitFrame')
const sideBySide = window.matchMedia('(min-width: 768px)')

if (intro && h1 && media) {
  let busy = false

  /* The line box starts half a lead above the letters. Comparing that edge
     to the frame reports the words as higher when only the leading is. */
  const letterTop = () => {
    const range = document.createRange()
    range.selectNodeContents(h1)
    const rects = range.getClientRects()
    let top = Infinity
    for (const r of rects) top = Math.min(top, r.top)
    const cs = getComputedStyle(h1)
    const lead = Math.max(0, (parseFloat(cs.lineHeight) - parseFloat(cs.fontSize)) / 2)
    return top + lead
  }

  const alignTop = () => {
    let prev = Infinity
    for (let i = 0; i < 8; i++) {
      const gap = media.getBoundingClientRect().top - letterTop()
      if (gap <= 0.5) return
      if (gap >= prev - 0.25) return
      prev = gap
      const current = parseFloat(h1.style.marginTop) || 0
      h1.style.marginTop = `${current + gap}px`
    }
  }

  const pastBottom = () =>
    h1.getBoundingClientRect().bottom > media.getBoundingClientRect().bottom + 0.5

  const widen = () => {
    const narrow = h1.getBoundingClientRect().width
    const left = h1.getBoundingClientRect().left
    const room = Math.max(narrow, window.innerWidth - left - 16)
    const probe = h1.cloneNode(true)
    probe.style.cssText = 'position:absolute;left:0;top:0;width:max-content;max-width:none;max-height:none;white-space:nowrap;visibility:hidden;pointer-events:none;margin:0;'
    document.body.appendChild(probe)
    const full = probe.getBoundingClientRect().width
    probe.remove()

    let lo = narrow
    let hi = Math.min(Math.max(full, narrow), room)
    if (hi <= lo + 0.5) return
    for (let i = 0; i < 16 && hi - lo > 0.5; i++) {
      const mid = (lo + hi) / 2
      h1.style.width = `${mid}px`
      alignTop()
      if (!pastBottom()) hi = mid
      else lo = mid
    }
    h1.style.width = `${Math.ceil(hi)}px`
    alignTop()
  }

  const fit = () => {
    if (busy) return
    busy = true
    try {
      h1.style.width = ''
      h1.style.marginTop = ''
      h1.style.whiteSpace = ''
      h1.style.maxHeight = ''
      if (!sideBySide.matches) return

      const frameH = media.getBoundingClientRect().width * 4 / 3
      intro.style.setProperty('--hero-media-h', `${frameH}px`)
      alignTop()
      if (pastBottom()) widen()
    } finally {
      busy = false
    }
  }

  sideBySide.addEventListener('change', fit)
  window.addEventListener('resize', fit)
  document.fonts.ready.then(fit)
  document.fonts.addEventListener?.('loadingdone', fit)
  new MutationObserver(fit).observe(h1, { childList: true, characterData: true, subtree: true })
  fit()
}
