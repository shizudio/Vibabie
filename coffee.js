/* ─────────────────────────────────────────────────────────
 * SCROLL STORYBOARD — driven by native page position, never elapsed time.
 *
 *  stage 0   intro + collage; the frame matches the image column
 *  stage 1   stage top travels 80vh → 0; the frame widens and grows
 *  stage 2   the frame fills the viewport; the live page is settled there
 *
 * The iframe is always laid out at the full viewport and clipped to the
 * frame, with its top-left in the frame's top-left. Opacity is the scroll
 * progress. The page never reflows into the smaller frame, so it does not
 * appear squeezed on the way in. Pointers and keyboard reach it only once
 * the frame fills the screen.
 * Scrolling back fades it out until the frame fills. After that, Back to
 * project is the exit, and the fade runs again from the intro.
 *
 * Reduced motion skips the in-between: the frame and the page snap from
 * hidden to full when the stage reaches the top. No wheel or touch
 * interception, child-frame messaging, frame reloads, or programmatic
 * scrolling during a gesture. Opacity is written from scroll position, not
 * from a timed transition.
 *
 * Once the frame fills the screen it stays there. Further parent scroll used
 * to unpin the iframe and reveal the page underneath, so two scroll contexts
 * fought. Parent overflow locks until "Back to project", which is a click,
 * not a gesture. The fade-in on the way there is unchanged.
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

    let locked = false
    const back = stage.querySelector('.coffee-return')

    function restoreWidget() {
      if (hiddenWidget) hiddenWidget.inert = previousWidgetInert
      hiddenWidget = null
    }

    function holdFullscreen() {
      const viewport = window.visualViewport
      const height = viewport?.height || window.innerHeight
      const width = viewport?.width || document.documentElement.clientWidth
      const top = viewport?.offsetTop || 0
      const left = viewport?.offsetLeft || 0
      stage.style.setProperty('--coffee-viewport-top', `${top}px`)
      stage.style.setProperty('--coffee-viewport-left', `${left}px`)
      stage.style.setProperty('--coffee-viewport-width', `${width}px`)
      stage.style.setProperty('--coffee-viewport-height', `${height}px`)
      stage.style.setProperty('--coffee-frame-left', '0px')
      stage.style.setProperty('--coffee-frame-width', `${width}px`)
      stage.style.setProperty('--coffee-frame-height', `${height}px`)
      stage.style.setProperty('--coffee-iframe-opacity', '1')
      stage.dataset.coffeeStage = 'immersive'
      stage.dataset.coffeeLocked = 'true'
      document.body.classList.add('coffee-is-immersive')
      if (frame.inert) frame.inert = false
      if (originalTabIndex === null) frame.removeAttribute('tabindex')
      else frame.setAttribute('tabindex', originalTabIndex)
    }

    function lockParent() {
      if (locked) return
      locked = true
      const y = window.scrollY || document.documentElement.scrollTop || 0
      document.body.style.position = 'fixed'
      document.body.style.top = `-${y}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.body.style.width = '100%'
      document.body.style.overflow = 'hidden'
      holdFullscreen()
    }

    function unlockParent() {
      if (!locked) return
      locked = false
      delete stage.dataset.coffeeLocked
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.width = ''
      document.body.style.overflow = ''
    }

    function onBack(event) {
      if (!locked) return
      event.preventDefault()
      unlockParent()
      window.scrollTo(0, 0)
      history.pushState(null, '', '#coffee-intro')
      // scrollY was already 0 while the body was fixed, so the scroll event
      // does not fire. Recompute the frame or it stays full-screen at the top.
      render()
    }

    function render() {
      pending = 0
      if (destroyed) return
      if (!stage.isConnected) { destroy(); return }
      if (locked) { holdFullscreen(); return }

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
      const motionStage = immersive ? 2 : progress > 0 ? 1 : 0

      const frameLeft = initial.left + (left - initial.left) * progress
      const frameWidth = initial.width + (width - initial.width) * progress
      const frameHeight = height * (FRAME_MOTION.framedHeight + (1 - FRAME_MOTION.framedHeight) * progress)

      stage.style.setProperty('--coffee-viewport-top', `${top}px`)
      stage.style.setProperty('--coffee-viewport-left', `${left}px`)
      stage.style.setProperty('--coffee-viewport-width', `${width}px`)
      stage.style.setProperty('--coffee-viewport-height', `${height}px`)
      stage.style.setProperty('--coffee-frame-left', `${frameLeft}px`)
      stage.style.setProperty('--coffee-frame-width', `${frameWidth}px`)
      stage.style.setProperty('--coffee-frame-height', `${frameHeight}px`)
      // Opacity tracks scroll progress. The page is already laid out at the
      // full viewport and clipped to this frame, so it fades in at full size
      // and is only fully visible once the frame fills the screen.
      stage.style.setProperty('--coffee-iframe-opacity', immersive ? '1' : String(progress))
      stage.dataset.coffeeStage = ['framed', 'expanding', 'immersive'][motionStage]
      document.body.classList.toggle('coffee-is-immersive', immersive)

      // The live page accepts pointers only once it fills the screen.
      if (frame.inert !== !immersive) frame.inert = !immersive
      if (immersive) {
        if (originalTabIndex === null) frame.removeAttribute('tabindex')
        else frame.setAttribute('tabindex', originalTabIndex)
      } else {
        frame.setAttribute('tabindex', '-1')
      }

      if (immersive) lockParent()

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

    back?.addEventListener('click', onBack)
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
      back?.removeEventListener('click', onBack)
      unlockParent()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', requestRender)
      window.visualViewport?.removeEventListener('resize', requestRender)
      window.visualViewport?.removeEventListener('scroll', requestRender)
      reducedMotion.removeEventListener('change', requestRender)
      document.body.classList.remove('coffee-is-immersive')
      restoreWidget()
      frame.inert = false
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
