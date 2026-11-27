/* ─────────────────────────────────────────────────────────
 * SCROLL STORYBOARD — driven by native page position, never elapsed time.
 *
 *  stage 0   intro + collage; the live frame matches the image column
 *  stage 1   stage top travels 80vh → 0; frame widens and grows to viewport
 *  stage 2   stage is at the top; same live iframe fills the sticky viewport
 *  reverse   scrolling back unwinds those exact dimensions to the collage
 *
 * Reduced motion skips stage 1's zoom. No wheel/touch interception, scroll
 * locks, child-frame messaging, frame reloads, or programmatic scrolling.
 * ───────────────────────────────────────────────────────── */

const FRAME_MOTION = {
  expansionDistance: 0.8, // viewport fraction before the stage reaches the top
  framedHeight:      0.8, // initial height as a viewport fraction
  fullThreshold:   0.999, // normalized threshold for the immersive state
}

const stage = document.getElementById('coffee-stage')
const origin = document.querySelector('[data-coffee-frame-origin]')
const frame = stage?.querySelector('iframe')

if (stage && origin && frame) {
  window.__coffeeImmersionCleanup?.()
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let dispose = () => {}

  function mount() {
    dispose()
    let pending = 0
    let visible = true
    let destroyed = false
    let hiddenWidget = null
    let previousWidgetInert = false
    const originalTabIndex = frame.getAttribute('tabindex')

    function restoreWidget() {
      if (hiddenWidget) hiddenWidget.inert = previousWidgetInert
      hiddenWidget = null
    }

    function render() {
      pending = 0
      if (destroyed) return
      if (!stage.isConnected) { destroy(); return }

      const bounds = stage.getBoundingClientRect()
      const initial = origin.getBoundingClientRect()
      // Visual viewport coordinates also cover iOS toolbar/keyboard changes
      // and zoom; normal desktop geometry remains exactly the layout viewport.
      const viewport = window.visualViewport
      const height = viewport?.height || window.innerHeight
      const width = viewport?.width || document.documentElement.clientWidth
      const top = viewport?.offsetTop || 0
      const left = viewport?.offsetLeft || 0
      const distanceToTop = bounds.top - top
      const raw = Math.min(1, Math.max(0, 1 - distanceToTop / (height * FRAME_MOTION.expansionDistance)))
      const progress = reducedMotion.matches ? (distanceToTop <= 0 ? 1 : 0) : raw * raw * (3 - 2 * raw)
      // Keep the exit control and widget clearance through the sticky stage's
      // departure, including fractional viewport edges on mobile browsers.
      const immersive = progress >= FRAME_MOTION.fullThreshold && distanceToTop <= 0 && bounds.bottom > top
      const motionStage = immersive ? 2 : progress > 0 && progress < FRAME_MOTION.fullThreshold ? 1 : 0

      stage.style.setProperty('--coffee-viewport-top', `${top}px`)
      stage.style.setProperty('--coffee-viewport-left', `${left}px`)
      stage.style.setProperty('--coffee-viewport-height', `${height}px`)
      stage.style.setProperty('--coffee-frame-left', `${initial.left + (left - initial.left) * progress}px`)
      stage.style.setProperty('--coffee-frame-width', `${initial.width + (width - initial.width) * progress}px`)
      stage.style.setProperty('--coffee-frame-height', `${height * (FRAME_MOTION.framedHeight + (1 - FRAME_MOTION.framedHeight) * progress)}px`)
      stage.dataset.coffeeStage = ['framed', 'expanding', 'immersive'][motionStage]
      document.body.classList.toggle('coffee-is-immersive', immersive)

      // Only the changing-size interval yields pointer/keyboard input to the
      // parent. Both settled frame states retain native iframe interaction.
      if (motionStage === 1) frame.setAttribute('tabindex', '-1')
      else if (originalTabIndex === null) frame.removeAttribute('tabindex')
      else frame.setAttribute('tabindex', originalTabIndex)

      const widget = document.getElementById('vinyl-widget')
      if (immersive && widget) {
        if (hiddenWidget !== widget) {
          restoreWidget()
          hiddenWidget = widget
          previousWidgetInert = widget.inert
        }
        widget.inert = true
      } else restoreWidget()
    }

    function requestRender() {
      if (!pending && !destroyed) pending = requestAnimationFrame(render)
    }
    function onScroll() {
      if (visible) requestRender()
    }

    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting
      requestRender()
    }, { rootMargin: '100% 0px' })
    observer.observe(stage)
    // Router changes can replace <main> without a pagehide event.
    const removalObserver = new MutationObserver(() => {
      if (!stage.isConnected) destroy()
      else requestRender()
    })
    removalObserver.observe(document.body, { childList: true })

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', requestRender, { passive: true })
    window.visualViewport?.addEventListener('resize', requestRender, { passive: true })
    window.visualViewport?.addEventListener('scroll', requestRender, { passive: true })
    reducedMotion.addEventListener('change', requestRender)
    requestRender()

    dispose = () => {
      destroyed = true
      cancelAnimationFrame(pending)
      observer.disconnect()
      removalObserver.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', requestRender)
      window.visualViewport?.removeEventListener('resize', requestRender)
      window.visualViewport?.removeEventListener('scroll', requestRender)
      reducedMotion.removeEventListener('change', requestRender)
      document.body.classList.remove('coffee-is-immersive')
      restoreWidget()
      if (originalTabIndex === null) frame.removeAttribute('tabindex')
      else frame.setAttribute('tabindex', originalTabIndex)
    }
  }

  function onPageHide() { dispose() }
  function onPageShow(event) { if (event.persisted && stage.isConnected) mount() }
  function destroy() {
    dispose()
    window.removeEventListener('pagehide', onPageHide)
    window.removeEventListener('pageshow', onPageShow)
    if (window.__coffeeImmersionCleanup === destroy) delete window.__coffeeImmersionCleanup
  }

  window.__coffeeImmersionCleanup = destroy
  window.addEventListener('pagehide', onPageHide, { passive: true })
  window.addEventListener('pageshow', onPageShow, { passive: true })
  mount()
}
