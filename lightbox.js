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

  function open(src, caption) {
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
    overlayEl.classList.add('open')
    overlayEl.setAttribute('aria-hidden', 'false')
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'
  }

  function close() {
    overlayEl.classList.remove('open')
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
    // Delay src clear so CSS transition completes before image disappears
    setTimeout(() => { imgEl.src = '' }, 350)
  }

  closeBtn.addEventListener('click', close)

  overlayEl.addEventListener('click', e => {
    if (e.target === overlayEl) close()
  })

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlayEl.classList.contains('open')) close()
  })

  return { open, close }
}
