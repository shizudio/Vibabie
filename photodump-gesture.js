// Pinch, pan, and city swipe for an open photograph.
//
// iOS Safari / WKWebView does not deliver a two-finger pinch as pointermove,
// and it often does not deliver it as a changing touch distance either. The
// page pinch recognizer freezes the touch coordinates, fires touchcancel,
// and reports the real scale on gesturechange (and sometimes on the touch
// event itself). touch-action does not stop that viewport pinch. A 1px
// jitter used to be treated as the finger distance moving, which discarded
// the WebKit scale, and touchcancel used to drop the gesture before that
// scale arrived. The photograph stayed at 1x. Headless Chrome never takes
// this path.
//
// Touch pointers are ignored. Touch events own the phone gesture, including
// the one-finger city swipe, so a cancelled pointer cannot drop it. A
// touchcancel during a pinch keeps the scale baseline so gesturechange can
// still land. Mouse and pen stay on pointer events. A pinch that ends at or
// under the snap threshold settles back to 1x. While zoomed, one finger pans
// and does not change photographs. Two fingers never change photographs.

import { clampPhotoPan, panBy, photoScale, pinchPan, releaseStep, settleScale } from './photodump-swipe.js'

// A resting finger jitters by a few pixels. That is not a pinch. WebKit's
// scale stays in charge until the finger distance has clearly changed.
const FINGER_PINCH = 0.08

export function blockBrowserPinch(open, mode) {
  return open === true && mode === 'photo'
}

// The map can be dragged whenever the lightbox is closed, including on a
// phone. Dragging stays off while the lightbox is open.
export function mapShouldDrag(dialogOpen) {
  return dialogOpen !== true
}

// iOS rubber-bands the visual viewport unless the page itself is fixed.
// overflow: hidden does not stop that shift.
export function pageLockStyle(locked) {
  if (locked) return { position: 'fixed', inset: '0', width: '100%', overflow: 'hidden' }
  return { position: '', inset: '', width: '', overflow: '' }
}

export function createPhotoGesture() {
  const zoom = { scale: 1, x: 0, y: 0 }
  const pointers = new Map()
  let gesture = null
  let source = null

  function transform() {
    return { scale: zoom.scale, x: zoom.x, y: zoom.y }
  }

  function resetTransform() {
    zoom.scale = 1
    zoom.x = 0
    zoom.y = 0
    pointers.clear()
    gesture = null
    source = null
  }

  function upsert(touches) {
    for (const touch of touches) pointers.set(touch.id, { id: touch.id, x: touch.x, y: touch.y })
  }

  function replace(touches) {
    const seen = new Set(touches.map(touch => touch.id))
    for (const id of [...pointers.keys()]) if (!seen.has(id)) pointers.delete(id)
    upsert(touches)
  }

  function pair() {
    const saved = gesture?.pinch?.ids?.map(id => pointers.get(id)).filter(Boolean)
    if (saved && saved.length >= 2) return saved.slice(0, 2)
    return [...pointers.values()].slice(0, 2)
  }

  function beginPinch(frame) {
    const points = [...pointers.values()].slice(0, 2)
    if (points.length < 2 || !frame) return null
    const midX = (points[0].x + points[1].x) / 2
    const midY = (points[0].y + points[1].y) / 2
    return {
      ids: points.map(point => point.id),
      startDistance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
      startScale: zoom.scale,
      startPan: { x: zoom.x, y: zoom.y },
      startFocal: { x: midX - frame.cx, y: midY - frame.cy },
      cx: frame.cx,
      cy: frame.cy,
      width: frame.width,
      height: frame.height,
      nativeScale: 0,
      fingersMoved: false,
    }
  }

  function writePinch(pinch, scale, focal) {
    const pan = pinchPan({
      startPan: pinch.startPan,
      startFocal: pinch.startFocal,
      focal,
      startScale: pinch.startScale,
      scale,
    })
    const clamped = clampPhotoPan(pan, scale, pinch.width, pinch.height)
    zoom.scale = scale
    zoom.x = clamped.x
    zoom.y = clamped.y
  }

  function fingerRatio(pinch) {
    const points = pair()
    if (!pinch || points.length < 2 || !(pinch.startDistance > 0)) return null
    const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
    return distance / pinch.startDistance
  }

  function applyFingerPinch() {
    const pinch = gesture?.pinch
    const ratio = fingerRatio(pinch)
    if (ratio == null) return false
    // Decide ownership before the native-scale guard. A real spread has to
    // be able to take over after gesturestart recorded a scale of 1.
    if (Math.abs(ratio - 1) >= FINGER_PINCH) pinch.fingersMoved = true
    if (!pinch.fingersMoved && pinch.nativeScale > 0) return false
    const points = pair()
    const focal = {
      x: (points[0].x + points[1].x) / 2 - pinch.cx,
      y: (points[0].y + points[1].y) / 2 - pinch.cy,
    }
    writePinch(pinch, photoScale(pinch.startScale, 1, ratio), focal)
    return Math.abs(ratio - 1) >= 0.001
  }

  function scaleBaseline(frame) {
    const box = frame || { cx: 0, cy: 0, width: 0, height: 0 }
    return {
      ids: [],
      startDistance: 1,
      startScale: zoom.scale,
      startPan: { x: zoom.x, y: zoom.y },
      startFocal: { x: 0, y: 0 },
      cx: box.cx,
      cy: box.cy,
      width: box.width,
      height: box.height,
      nativeScale: 0,
      fingersMoved: false,
    }
  }

  function applyNativeScale(nativeScale) {
    const pinch = gesture?.pinch
    if (!pinch || !(nativeScale > 0) || pinch.fingersMoved) return false
    pinch.nativeScale = nativeScale
    writePinch(pinch, photoScale(pinch.startScale, 1, nativeScale), pinch.startFocal)
    return true
  }

  function beginPan(point, frame) {
    if (!point || !frame) return null
    return { x: point.x, y: point.y, panX: zoom.x, panY: zoom.y, width: frame.width, height: frame.height }
  }

  function applyPan(point) {
    if (!gesture?.pan || !(zoom.scale > 1) || !point) return false
    const next = panBy(
      { x: gesture.pan.panX, y: gesture.pan.panY },
      point.x - gesture.pan.x,
      point.y - gesture.pan.y,
      zoom.scale,
    )
    const clamped = clampPhotoPan(next, zoom.scale, gesture.pan.width, gesture.pan.height)
    zoom.x = clamped.x
    zoom.y = clamped.y
    return true
  }

  function finish(commit, x, y) {
    const finished = gesture
    const wasTouch = source === 'touch'
    pointers.clear()
    gesture = null
    source = null
    if (!finished) return { zoom: false, direction: 0, swallow: false }
    const settled = settleScale(zoom.scale)
    let changed = false
    if (settled === 1 && (zoom.scale !== 1 || zoom.x !== 0 || zoom.y !== 0)) {
      zoom.scale = 1
      zoom.x = 0
      zoom.y = 0
      changed = true
    }
    const direction = commit ? releaseStep(settled, x - finished.startX, y - finished.startY, finished.pinched) : 0
    const travel = Math.hypot(x - finished.startX, y - finished.startY)
    const moved = finished.pinched || travel > 8 || direction !== 0
    // A touch drag calls preventDefault on touchend, which suppresses the
    // synthetic click. The mouse path has no such event, so a step swallows
    // the next click instead. Swallowing a pinch would eat the next tap,
    // because the two-finger touchstart already stopped that click.
    return {
      zoom: changed,
      direction,
      swallow: !wasTouch && direction !== 0,
      prevent: wasTouch && moved,
    }
  }

  function photoGesture(input) {
    return input.open && input.mode === 'photo' && !input.control && !(input.pointerType === 'mouse' && input.button !== 0)
  }

  function pointerDown(input, frame) {
    if (input.pointerType === 'touch' || source === 'touch') return null
    if (!photoGesture(input)) return { backdrop: !input.control && input.backdrop === true, capture: false, zoom: false }
    source = 'pointer'
    pointers.set(input.pointerId, { id: input.pointerId, x: input.x, y: input.y })
    if (pointers.size === 1) {
      const point = pointers.get(input.pointerId)
      gesture = {
        pinched: false,
        startX: input.x,
        startY: input.y,
        pan: zoom.scale > 1 ? beginPan(point, frame) : null,
        pinch: null,
      }
      return { backdrop: input.backdrop === true, capture: true, zoom: false }
    }
    if (!gesture) gesture = { pinched: true, startX: input.x, startY: input.y, pan: null, pinch: null }
    gesture.pinched = true
    gesture.pan = null
    gesture.pinch = beginPinch(frame)
    return { backdrop: false, capture: true, zoom: false }
  }

  function pointerMove(input) {
    if (input.pointerType === 'touch' || source !== 'pointer') return null
    const point = pointers.get(input.pointerId)
    if (!point || !gesture) return null
    point.x = input.x
    point.y = input.y
    if (pointers.size >= 2 && gesture.pinch) {
      applyFingerPinch()
      return { zoom: true, backdrop: false }
    }
    if (gesture.pan && zoom.scale > 1) {
      applyPan(point)
      return { zoom: true, backdrop: false }
    }
    if (Math.hypot(input.x - gesture.startX, input.y - gesture.startY) > 8) return { zoom: false, backdrop: false }
    return { zoom: false }
  }

  function pointerUp(input, frame) {
    if (input.pointerType === 'touch' || source !== 'pointer') return null
    if (!pointers.has(input.pointerId)) return null
    pointers.delete(input.pointerId)
    if (!gesture) {
      source = pointers.size ? source : null
      return null
    }
    if (pointers.size >= 2) {
      gesture.pinch = beginPinch(frame)
      return { zoom: false }
    }
    if (pointers.size === 1) {
      const point = pointers.values().next().value
      gesture.pinch = null
      gesture.pan = zoom.scale > 1 ? beginPan(point, frame) : null
      return { zoom: false }
    }
    return finish(input.commit, input.x, input.y)
  }

  function touchStart(input, frame) {
    if (source === 'pointer') return null
    if (!(input.open && input.mode === 'photo')) {
      return { prevent: false, backdrop: !input.control && input.backdrop === true, zoom: false }
    }
    // One finger on Previous, Next, or Close stays a button press. Two fingers
    // are a pinch even if one of them lands on a button.
    if (input.control && (input.touches?.length || 0) < 2 && pointers.size < 2) {
      return { prevent: false, backdrop: false, zoom: false }
    }
    if (!input.touches?.length) return { prevent: false, zoom: false }
    // touchcancel kept the pinch so gesturechange could land. If that end
    // event never arrived, settle before the next finger starts a new gesture.
    if (gesture?.orphaned && pointers.size === 0) {
      const settled = settleScale(zoom.scale)
      if (settled === 1 && (zoom.scale !== 1 || zoom.x !== 0 || zoom.y !== 0)) {
        zoom.scale = 1
        zoom.x = 0
        zoom.y = 0
      }
      gesture = null
      source = null
    }
    source = 'touch'
    upsert(input.touches)
    if (pointers.size >= 2) {
      if (!gesture) {
        const first = [...pointers.values()][0]
        gesture = { pinched: true, startX: first.x, startY: first.y, pan: null, pinch: null }
      }
      gesture.pinched = true
      gesture.pan = null
      gesture.pinch = beginPinch(frame)
      return { prevent: true, backdrop: false, zoom: false }
    }
    const point = [...pointers.values()][0]
    if (!point) return { prevent: false, zoom: false }
    gesture = {
      pinched: false,
      startX: point.x,
      startY: point.y,
      pan: zoom.scale > 1 ? beginPan(point, frame) : null,
      pinch: null,
    }
    return { prevent: false, backdrop: input.backdrop === true, zoom: false }
  }

  function touchMove(input, frame) {
    if (source !== 'touch' || !gesture) return null
    replace(input.touches)
    const webkitScale = Number.isFinite(input.scale) && input.scale > 0 ? input.scale : 0
    if (pointers.size >= 2) {
      if (!gesture.pinch) {
        gesture.pinched = true
        gesture.pan = null
        gesture.pinch = beginPinch(frame) || scaleBaseline(frame)
      }
      const zoomed = applyFingerPinch()
      const native = webkitScale ? applyNativeScale(webkitScale) : false
      return { prevent: true, zoom: Boolean(zoomed || native), backdrop: false }
    }
    // Coordinates never arrived, but the touch event still carries WebKit's scale.
    if (webkitScale && Math.abs(webkitScale - 1) > 0.001) {
      gesture.pinched = true
      gesture.pan = null
      if (!gesture.pinch) gesture.pinch = scaleBaseline(frame)
      return { prevent: true, zoom: applyNativeScale(webkitScale), backdrop: false }
    }
    const point = [...pointers.values()][0]
    if (gesture.pan && zoom.scale > 1) {
      applyPan(point)
      return { prevent: true, zoom: true, backdrop: false }
    }
    const travel = point ? Math.hypot(point.x - gesture.startX, point.y - gesture.startY) : 0
    return { prevent: travel > 8, zoom: false, backdrop: travel > 8 ? false : undefined }
  }

  function touchEnd(input, frame) {
    if (source !== 'touch' || !gesture) return null
    const previous = [...pointers.values()]
    replace(input.remaining)
    if (pointers.size >= 2) {
      gesture.pinch = beginPinch(frame)
      gesture.pan = null
      return { prevent: true, zoom: false, direction: 0, swallow: false }
    }
    if (pointers.size === 1) {
      const point = pointers.values().next().value
      gesture.pinch = null
      gesture.pan = zoom.scale > 1 ? beginPan(point, frame) : null
      return { prevent: Boolean(gesture.pinched) || zoom.scale > 1, zoom: false, direction: 0, swallow: false }
    }
    const lifted = input.lifted
    const gone = previous.find(point => !pointers.has(point.id))
    const x = lifted ? lifted.x : (gone ? gone.x : gesture.startX)
    const y = lifted ? lifted.y : (gone ? gone.y : gesture.startY)
    return finish(input.commit, x, y)
  }

  // iOS cancels the touch stream when it classifies a pinch, then keeps
  // reporting scale on gesturechange. Finishing here left the photograph at 1x.
  function touchCancel() {
    if (source !== 'touch' || !gesture) return null
    if (gesture.pinched || gesture.pinch || pointers.size >= 2) {
      pointers.clear()
      gesture.orphaned = true
      gesture.pan = null
      return { prevent: true, zoom: false, direction: 0, swallow: false }
    }
    const point = [...pointers.values()][0]
    const x = point ? point.x : gesture.startX
    const y = point ? point.y : gesture.startY
    return finish(false, x, y)
  }

  function nativePinch(nativeScale, frame, begin = false) {
    if (source === 'pointer' || !(nativeScale > 0)) return null
    // Scale 1 with no pinch in progress is gesturestart, not a zoom. A
    // one-finger swipe has to stay free to step the city.
    const idle = pointers.size < 2 && !gesture?.pinch && Math.abs(nativeScale - 1) <= 0.001
    if (idle) return { zoom: false, backdrop: false }
    if (source !== 'touch') source = 'touch'
    if (!gesture) gesture = { pinched: true, startX: 0, startY: 0, pan: null, pinch: null, orphaned: false }
    // A new gesturestart rebases onto the current scale. gesturechange must
    // not rebase, or a cumulative WebKit scale would compound every event.
    const reset = begin && !gesture.pinch?.fingersMoved && !(gesture.pinch?.nativeScale > 1)
    if (!gesture.pinch || reset) {
      gesture.pinched = true
      gesture.pan = null
      gesture.pinch = beginPinch(frame) || scaleBaseline(frame)
    }
    if (!gesture.pinch) return { zoom: false, backdrop: false }
    return { zoom: applyNativeScale(nativeScale), backdrop: false }
  }

  function endNativePinch() {
    if (!gesture?.pinched && !gesture?.pinch && !gesture?.orphaned) return null
    // A finger still on the glass is the touchend path (pan, or the end of
    // the swipe). gestureend only commits a pinch whose touches were cancelled.
    if (pointers.size > 0 && !gesture.orphaned) return { zoom: false, direction: 0, swallow: false }
    const point = [...pointers.values()][0]
    const x = point ? point.x : gesture.startX
    const y = point ? point.y : gesture.startY
    return finish(false, x, y)
  }

  return { transform, resetTransform, pointerDown, pointerMove, pointerUp, touchStart, touchMove, touchEnd, touchCancel, nativePinch, endNativePinch }
}

function listed(list) {
  return Array.from(list, touch => ({ id: touch.identifier, x: touch.clientX, y: touch.clientY }))
}

function stopNative(event) {
  if (event.cancelable) event.preventDefault()
}

// Wires the controller to a dialog. Touch and gesture listeners are
// non-passive so Safari can be told not to zoom the page. Pointer listeners
// stay passive: mouse drags do not need canceling, and touch pointers are
// ignored so setPointerCapture is never called for a finger.
export function attachPhotoGestures(dialog, doc, gestures, hooks) {
  const frame = () => hooks.frame()
  const live = () => ({ open: hooks.open(), mode: hooks.mode() })

  const blockTouch = event => {
    if (!blockBrowserPinch(hooks.open(), hooks.mode())) return false
    if (event.type === 'touchstart' && hooks.isControl(event.target) && event.touches.length < 2) return false
    // Every move while a photograph is open. A one-finger drag used to be
    // left to the browser, which rubber-banded the map in place.
    if (event.type === 'touchmove') return true
    return event.touches.length >= 2
  }

  const seenTouch = new WeakSet()
  const touchTargets = [dialog, doc]
  if (doc.defaultView && doc.defaultView !== doc) touchTargets.push(doc.defaultView)

  function onTouchStart(event) {
    if (!hooks.open()) return
    if (seenTouch.has(event)) return
    seenTouch.add(event)
    const result = gestures.touchStart({
      ...live(),
      touches: listed(event.touches),
      control: hooks.isControl(event.target),
      backdrop: hooks.isBackdrop(event.target),
    }, frame())
    if (blockTouch(event) || result?.prevent) stopNative(event)
    hooks.apply(result)
  }

  function onTouchMove(event) {
    if (!blockBrowserPinch(hooks.open(), hooks.mode())) return
    // Cancel before the handler, including a short vertical nudge. Once iOS
    // has begun a scroll, later events are not cancelable and the page shifts.
    stopNative(event)
    if (seenTouch.has(event)) return
    seenTouch.add(event)
    const result = gestures.touchMove({
      touches: listed(event.touches),
      scale: event.scale,
    }, frame())
    hooks.apply(result)
  }

  function onTouchEnd(commit) {
    return event => {
      if (seenTouch.has(event)) return
      seenTouch.add(event)
      const lifted = event.changedTouches?.[0]
      const result = gestures.touchEnd({
        remaining: listed(event.touches),
        lifted: lifted ? { id: lifted.identifier, x: lifted.clientX, y: lifted.clientY } : null,
        commit: commit && hooks.open() && hooks.mode() === 'photo',
      }, frame())
      if (result?.prevent) stopNative(event)
      hooks.apply(result)
    }
  }

  function onTouchCancel(event) {
    if (seenTouch.has(event)) return
    seenTouch.add(event)
    const result = gestures.touchCancel()
    if (result?.prevent) stopNative(event)
    hooks.apply(result)
  }

  for (const target of touchTargets) {
    target.addEventListener('touchstart', onTouchStart, { capture: true, passive: false })
    target.addEventListener('touchmove', onTouchMove, { capture: true, passive: false })
    target.addEventListener('touchend', onTouchEnd(true), { capture: true, passive: false })
    target.addEventListener('touchcancel', onTouchCancel, { capture: true, passive: false })
  }

  // One gesture event reaches every target on its path. Applying the scale
  // twice would rebase the second time and compound it.
  const handledGesture = new WeakSet()
  const stopGesture = event => {
    if (!blockBrowserPinch(hooks.open(), hooks.mode())) return
    stopNative(event)
    if (handledGesture.has(event)) return
    handledGesture.add(event)
    if (event.type === 'gesturestart') {
      hooks.apply(gestures.nativePinch(event.scale, frame(), true))
      return
    }
    if (event.type === 'gestureend') {
      if (event.scale > 0) hooks.apply(gestures.nativePinch(event.scale, frame()))
      hooks.apply(gestures.endNativePinch())
      return
    }
    if (event.type !== 'gesturechange') return
    hooks.apply(gestures.nativePinch(event.scale, frame()))
  }
  // The modal dialog is the target WebKit dispatches to. document (and
  // window) still see the event when it propagates, and that is what vetoes
  // the viewport pinch. The same handler is idempotent for one scale value.
  const gestureTargets = [dialog, doc]
  if (doc.defaultView && doc.defaultView !== doc) gestureTargets.push(doc.defaultView)
  for (const target of gestureTargets) {
    target.addEventListener('gesturestart', stopGesture, { capture: true, passive: false })
    target.addEventListener('gesturechange', stopGesture, { capture: true, passive: false })
    target.addEventListener('gestureend', stopGesture, { capture: true, passive: false })
  }

  dialog.addEventListener('pointerdown', event => {
    const result = gestures.pointerDown({
      ...live(),
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      button: event.button,
      x: event.clientX,
      y: event.clientY,
      control: hooks.isControl(event.target),
      backdrop: hooks.isBackdrop(event.target),
    }, frame())
    if (result?.capture) hooks.capturePointer(event.pointerId)
    hooks.apply(result)
  }, { passive: true })

  doc.addEventListener('pointermove', event => {
    hooks.apply(gestures.pointerMove({
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      x: event.clientX,
      y: event.clientY,
    }))
  }, { passive: true })

  const endPointer = commit => event => {
    hooks.apply(gestures.pointerUp({
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      x: event.clientX,
      y: event.clientY,
      commit: commit && hooks.open() && hooks.mode() === 'photo',
    }, frame()))
  }
  doc.addEventListener('pointerup', endPointer(true), { passive: true })
  doc.addEventListener('pointercancel', endPointer(false), { passive: true })

}

// Used as an inline style. A custom property inside `transform` on a
// descendant of a modal dialog is not reliably recomposited on iOS, so the
// photograph can be scaled in state and still look unchanged.
export function photoTransformStyle(zoom) {
  const x = Number.isFinite(zoom?.x) ? zoom.x : 0
  const y = Number.isFinite(zoom?.y) ? zoom.y : 0
  const scale = Number.isFinite(zoom?.scale) ? zoom.scale : 1
  return `translate(${x}px, ${y}px) scale(${scale})`
}
