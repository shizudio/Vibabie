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
  function open(src, caption) {
    imgEl.src = src
    if (captionEl) {
      captionEl.textContent = caption || ''
      captionEl.style.display = caption ? '' : 'none'
    }
    overlayEl.classList.add('open')
    overlayEl.setAttribute('aria-hidden', 'false')
    document.body.style.overflow = 'hidden'
  }

  function close() {
    overlayEl.classList.remove('open')
    overlayEl.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = ''
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
