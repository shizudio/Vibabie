// lightbox.js — shared lightbox utility

/**
 * Initialise a lightbox with the given DOM elements.
 *
 * @param {HTMLElement}       overlayEl  - the outer overlay div
 * @param {HTMLImageElement}  imgEl      - the <img> inside the lightbox
 * @param {HTMLElement|null}  captionEl  - the caption element (can be null)
 * @param {HTMLButtonElement} closeBtn   - the close button element
 * @returns {{ open(src: string, caption?: string): void, close(): void }}
 */
export function initLightbox(overlayEl, imgEl, captionEl, closeBtn) {
  let scrollY = 0
  let previousBodyStyles = null
  let previouslyFocused = null
  let isOpen = false
  overlayEl.inert = true
  overlayEl.setAttribute('role', 'dialog')
  overlayEl.setAttribute('aria-modal', 'true')
  if (!overlayEl.hasAttribute('aria-label') && !overlayEl.hasAttribute('aria-labelledby')) overlayEl.setAttribute('aria-label', 'Image viewer')

  function open(src, caption, trigger = document.activeElement) {
    if (isOpen) {
      imgEl.src = src
      if (captionEl) captionEl.textContent = caption || ''
      return
    }
    isOpen = true
    previouslyFocused = trigger
    scrollY = window.scrollY || document.documentElement.scrollTop || 0
    previousBodyStyles = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    }

    imgEl.src = src
    if (captionEl) {
      captionEl.textContent = caption || ''
      captionEl.style.display = caption ? '' : 'none'
    }
    overlayEl.inert = false
    overlayEl.classList.add('open')
    overlayEl.setAttribute('aria-hidden', 'false')
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'
    closeBtn.focus({ preventScroll: true })
  }

  function close() {
    if (!isOpen) return
    isOpen = false
    overlayEl.classList.remove('open')
    overlayEl.inert = true
    overlayEl.setAttribute('aria-hidden', 'true')
    if (previousBodyStyles) {
      document.body.style.position = previousBodyStyles.position
      document.body.style.top = previousBodyStyles.top
      document.body.style.left = previousBodyStyles.left
      document.body.style.right = previousBodyStyles.right
      document.body.style.width = previousBodyStyles.width
      document.body.style.overflow = previousBodyStyles.overflow
    } else {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.width = ''
      document.body.style.overflow = ''
    }
    window.scrollTo(0, scrollY)
    if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true })
    // Delay src clear so the CSS transition completes before the image
    // disappears — but only if the lightbox is still closed when the timer
    // fires. Reopening within the fade window used to have its brand-new
    // image cleared out from under it, leaving a broken <img> whose src had
    // resolved to the page URL. Only reachable by dismissing and reopening
    // quickly, which is exactly what people do.
    setTimeout(() => {
      if (!overlayEl.classList.contains('open')) imgEl.src = ''
    }, 350)
  }

  closeBtn.addEventListener('click', close)

  overlayEl.addEventListener('click', e => {
    if (e.target === overlayEl || e.target === imgEl.parentElement) close()
  })

  document.addEventListener('keydown', e => {
    if (!isOpen) return
    if (e.key === 'Escape') close()
    if (e.key === 'Tab') {
      const controls = [...overlayEl.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(element => !element.disabled && element.getClientRects().length)
      const first = controls[0], last = controls[controls.length - 1]
      if (!first) return
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  })

  return { open, close }
}
