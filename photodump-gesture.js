// Pinch, pan, and city swipe for an open photograph.
//
// iOS Safari does not deliver a usable two-finger pinch through Pointer
// Events. A pinch is a gesturestart/gesturechange sequence plus touch
// events. The browser then cancels the pointer stream (pointercancel) and,
// unless preventDefault runs on a non-passive touch or gesture listener,
// zooms the page instead of the photograph. touch-action: none is not
// enough there: these listeners were passive, so preventDefault could not
// run, and the photograph stayed at 1x. Headless Chrome never takes that
// path, which is why the pointer tracker looked fine.
//
// Touch pointers are ignored. Touch events own the phone gesture, including
// the one-finger city swipe, so a cancelled pointer cannot drop it. Mouse
// and pen stay on pointer events. A pinch that ends at or under the snap
// threshold settles back to 1x. While zoomed, one finger pans and does not
// change photographs. Two fingers never change photographs.

import { clampPhotoPan, panBy, photoScale, pinchPan, releaseStep, settleScale } from './photodump-swipe.js'

export function blockBrowserPinch(open, mode) {
  return open === true && mode === 'photo'
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

  function applyFingerPinch() {
    const pinch = gesture?.pinch
    if (!pinch) return false
    const points = pair()
    if (points.length < 2) return false
    const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
    // Safari sometimes freezes the touch coordinates and reports the pinch
    // only on gesturechange. Once a finger distance has actually changed,
    // that distance stays in charge, including a pinch back to the start.
    if (Math.abs(distance - pinch.startDistance) >= 1) pinch.fingersMoved = true
    if (!pinch.fingersMoved && pinch.nativeScale > 0) return false
    const focal = {
      x: (points[0].x + points[1].x) / 2 - pinch.cx,
      y: (points[0].y + points[1].y) / 2 - pinch.cy,
    }
    writePinch(pinch, photoScale(pinch.startScale, pinch.startDistance, distance), focal)
    return true
  }

  function applyNativeScale(nativeScale) {
    const pinch = gesture?.pinch
    if (!pinch || !(nativeScale > 0) || pinch.fingersMoved) return false
    pinch.nativeScale = nativeScale
    const points = pair()
    if (points.length >= 2) {
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
      if (Math.abs(distance - pinch.startDistance) >= 1) return false
    }
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
    if (pointers.size >= 2) {
      if (!gesture.pinch) {
        gesture.pinched = true
        gesture.pan = null
        gesture.pinch = beginPinch(frame)
      }
      const zoomed = applyFingerPinch()
      return { prevent: true, zoom: zoomed, backdrop: false }
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

  function nativePinch(nativeScale, frame) {
    if (source === 'pointer' || !(nativeScale > 0)) return null
    if (!gesture || pointers.size < 2) return { zoom: false }
    if (!gesture.pinch) {
      gesture.pinched = true
      gesture.pan = null
      gesture.pinch = beginPinch(frame)
    }
    return { zoom: applyNativeScale(nativeScale), backdrop: false }
  }

  return { transform, resetTransform, pointerDown, pointerMove, pointerUp, touchStart, touchMove, touchEnd, nativePinch }
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
    if (hooks.isControl(event.target) && event.touches.length < 2) return false
    if (event.touches.length >= 2) return true
    return event.type === 'touchmove' && gestures.transform().scale > 1
  }

  doc.addEventListener('touchstart', event => {
    if (blockTouch(event)) stopNative(event)
  }, { capture: true, passive: false })

  doc.addEventListener('touchmove', event => {
    if (blockTouch(event)) stopNative(event)
  }, { capture: true, passive: false })

  const stopGesture = event => {
    if (!blockBrowserPinch(hooks.open(), hooks.mode())) return
    stopNative(event)
    if (event.type !== 'gesturechange') return
    hooks.apply(gestures.nativePinch(event.scale, frame()))
  }
  doc.addEventListener('gesturestart', stopGesture, { capture: true, passive: false })
  doc.addEventListener('gesturechange', stopGesture, { capture: true, passive: false })
  doc.addEventListener('gestureend', stopGesture, { capture: true, passive: false })

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

  dialog.addEventListener('touchstart', event => {
    const result = gestures.touchStart({
      ...live(),
      touches: listed(event.touches),
      control: hooks.isControl(event.target),
      backdrop: hooks.isBackdrop(event.target),
    }, frame())
    if (result?.prevent) stopNative(event)
    hooks.apply(result)
  }, { capture: true, passive: false })

  dialog.addEventListener('touchmove', event => {
    const result = gestures.touchMove({
      touches: listed(event.touches),
    }, frame())
    if (result?.prevent) stopNative(event)
    hooks.apply(result)
  }, { capture: true, passive: false })

  const endTouch = commit => event => {
    const lifted = event.changedTouches?.[0]
    const result = gestures.touchEnd({
      remaining: listed(event.touches),
      lifted: lifted ? { id: lifted.identifier, x: lifted.clientX, y: lifted.clientY } : null,
      commit: commit && hooks.open() && hooks.mode() === 'photo',
    }, frame())
    if (result?.prevent) stopNative(event)
    hooks.apply(result)
  }
  dialog.addEventListener('touchend', endTouch(true), { passive: false })
  dialog.addEventListener('touchcancel', endTouch(false), { passive: false })
}
