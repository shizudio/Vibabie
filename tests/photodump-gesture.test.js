import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { attachPhotoGestures, blockBrowserPinch, createPhotoGesture } from '../photodump-gesture.js'

const frame = { cx: 0, cy: 0, width: 200, height: 200 }
const photo = { open: true, mode: 'photo', control: false, backdrop: false }

function gesture() {
  return createPhotoGesture()
}

test('an open photograph is the only place the browser pinch is cancelled', () => {
  assert.equal(blockBrowserPinch(true, 'photo'), true)
  assert.equal(blockBrowserPinch(true, 'grid'), false)
  assert.equal(blockBrowserPinch(false, 'photo'), false)
  assert.equal(blockBrowserPinch(true, 'map'), false)
})

test('touch pointers never scale the photograph', () => {
  // iOS delivers a pinch as touch and gesture events, then pointercancel.
  // A pointer-only tracker stays at 1x on that path.
  const zoom = gesture()
  assert.equal(zoom.pointerDown({ ...photo, pointerId: 1, pointerType: 'touch', button: 0, x: -50, y: 0 }, frame), null)
  assert.equal(zoom.pointerDown({ ...photo, pointerId: 2, pointerType: 'touch', button: 0, x: 50, y: 0 }, frame), null)
  assert.equal(zoom.pointerMove({ pointerId: 1, pointerType: 'touch', x: -120, y: 0 }), null)
  assert.equal(zoom.pointerMove({ pointerId: 2, pointerType: 'touch', x: 120, y: 0 }), null)
  assert.equal(zoom.pointerUp({ pointerId: 1, pointerType: 'touch', x: -120, y: 0, commit: false }, frame), null)
  assert.deepEqual(zoom.transform(), { scale: 1, x: 0, y: 0 })
})

test('two touch points scale the photograph and a sideways pinch does not step', () => {
  const zoom = gesture()
  const start = zoom.touchStart({ ...photo, touches: [{ id: 1, x: -50, y: 0 }, { id: 2, x: 50, y: 0 }] }, frame)
  assert.equal(start.prevent, true)
  const moved = zoom.touchMove({
    touches: [{ id: 1, x: -100, y: 40 }, { id: 2, x: 100, y: 40 }],
  }, frame)
  assert.equal(moved.prevent, true)
  assert.equal(zoom.transform().scale, 2)
  const end = zoom.touchEnd({
    remaining: [],
    lifted: { id: 2, x: 100, y: 40 },
    commit: true,
  }, frame)
  assert.equal(end.direction, 0)
  assert.equal(end.swallow, false)
  assert.equal(end.prevent, true)
  assert.equal(zoom.transform().scale, 2)
})

test('a second finger that arrives alone still starts the pinch', () => {
  const zoom = gesture()
  zoom.touchStart({ ...photo, touches: [{ id: 1, x: -50, y: 0 }] }, frame)
  const second = zoom.touchStart({ ...photo, touches: [{ id: 2, x: 50, y: 0 }] }, frame)
  assert.equal(second.prevent, true)
  zoom.touchMove({ touches: [{ id: 1, x: -100, y: 0 }, { id: 2, x: 100, y: 0 }] }, frame)
  assert.equal(zoom.transform().scale, 2)
})

test('pointercancel does not freeze or drop an in-progress pinch', () => {
  const zoom = gesture()
  zoom.touchStart({ ...photo, touches: [{ id: 1, x: -40, y: 0 }, { id: 2, x: 40, y: 0 }] }, frame)
  zoom.touchMove({ touches: [{ id: 1, x: -60, y: 0 }, { id: 2, x: 60, y: 0 }] }, frame)
  assert.equal(zoom.transform().scale, 1.5)
  assert.equal(zoom.pointerUp({ pointerId: 1, pointerType: 'touch', x: -60, y: 0, commit: false }, frame), null)
  assert.equal(zoom.pointerUp({ pointerId: 2, pointerType: 'touch', x: 60, y: 0, commit: false }, frame), null)
  zoom.touchMove({ touches: [{ id: 1, x: -80, y: 0 }, { id: 2, x: 80, y: 0 }] }, frame)
  assert.equal(zoom.transform().scale, 2)
})

test('gesture scale is used only while the touch points stay put', () => {
  const zoom = gesture()
  zoom.touchStart({ ...photo, touches: [{ id: 1, x: -50, y: 0 }, { id: 2, x: 50, y: 0 }] }, frame)
  zoom.touchMove({ touches: [{ id: 1, x: -50, y: 0 }, { id: 2, x: 50, y: 0 }] }, frame)
  assert.equal(zoom.nativePinch(2, frame).zoom, true)
  assert.equal(zoom.transform().scale, 2)
  zoom.touchMove({ touches: [{ id: 1, x: -50, y: 0 }, { id: 2, x: 50, y: 0 }] }, frame)
  assert.equal(zoom.transform().scale, 2)
  zoom.touchMove({ touches: [{ id: 1, x: -75, y: 0 }, { id: 2, x: 75, y: 0 }] }, frame)
  assert.equal(zoom.transform().scale, 1.5)
  zoom.nativePinch(4, frame)
  assert.equal(zoom.transform().scale, 1.5)
})

test('a pinch that barely leaves 1x snaps back, then a swipe steps', () => {
  const zoom = gesture()
  zoom.touchStart({ ...photo, touches: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 100, y: 0 }] }, frame)
  zoom.touchMove({ touches: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 102, y: 0 }] }, frame)
  assert.equal(zoom.transform().scale, 1.02)
  const end = zoom.touchEnd({ remaining: [], lifted: { id: 2, x: 102, y: 0 }, commit: true }, frame)
  assert.equal(end.direction, 0)
  assert.deepEqual(zoom.transform(), { scale: 1, x: 0, y: 0 })
  zoom.touchStart({ ...photo, touches: [{ id: 3, x: 180, y: 10 }] }, frame)
  zoom.touchMove({ touches: [{ id: 3, x: 20, y: 12 }] }, frame)
  const swipe = zoom.touchEnd({ remaining: [], lifted: null, commit: true }, frame)
  assert.equal(swipe.direction, 1)
  assert.equal(swipe.prevent, true)
})

test('one finger at 1x steps the city and does not cancel the touch on contact', () => {
  const zoom = gesture()
  const start = zoom.touchStart({ ...photo, touches: [{ id: 1, x: 200, y: 40 }], backdrop: true }, frame)
  assert.equal(start.prevent, false)
  assert.equal(start.backdrop, true)
  const nudge = zoom.touchMove({ touches: [{ id: 1, x: 196, y: 40 }] }, frame)
  assert.equal(nudge.prevent, false)
  const drag = zoom.touchMove({ touches: [{ id: 1, x: 40, y: 46 }] }, frame)
  assert.equal(drag.prevent, true)
  assert.equal(drag.backdrop, false)
  const end = zoom.touchEnd({ remaining: [], lifted: { id: 1, x: 40, y: 46 }, commit: true }, frame)
  assert.equal(end.direction, 1)
  assert.equal(zoom.transform().scale, 1)
})

test('a vertical touch does not step, and a cancelled touch does not step', () => {
  const zoom = gesture()
  zoom.touchStart({ ...photo, touches: [{ id: 1, x: 20, y: 20 }] }, frame)
  zoom.touchMove({ touches: [{ id: 1, x: 24, y: 140 }] }, frame)
  assert.equal(zoom.touchEnd({ remaining: [], lifted: { id: 1, x: 24, y: 140 }, commit: true }, frame).direction, 0)
  zoom.touchStart({ ...photo, touches: [{ id: 1, x: 80, y: 20 }] }, frame)
  zoom.touchMove({ touches: [{ id: 1, x: 0, y: 20 }] }, frame)
  assert.equal(zoom.touchEnd({ remaining: [], lifted: { id: 1, x: 0, y: 20 }, commit: false }, frame).direction, 0)
})

test('one finger pans a zoomed photograph and does not step, including at the edge', () => {
  const zoom = gesture()
  zoom.touchStart({ ...photo, touches: [{ id: 1, x: -50, y: 0 }, { id: 2, x: 50, y: 0 }] }, frame)
  zoom.touchMove({ touches: [{ id: 1, x: -100, y: 0 }, { id: 2, x: 100, y: 0 }] }, frame)
  assert.equal(zoom.transform().scale, 2)
  const lifted = zoom.touchEnd({ remaining: [{ id: 1, x: -100, y: 0 }], lifted: { id: 2, x: 100, y: 0 }, commit: true }, frame)
  assert.equal(lifted.direction, 0)
  const pan = zoom.touchMove({ touches: [{ id: 1, x: -20, y: 30 }] }, frame)
  assert.equal(pan.prevent, true)
  assert.deepEqual(zoom.transform(), { scale: 2, x: 80, y: 30 })
  zoom.touchMove({ touches: [{ id: 1, x: 400, y: 400 }] }, frame)
  assert.deepEqual(zoom.transform(), { scale: 2, x: 100, y: 100 })
  const end = zoom.touchEnd({ remaining: [], lifted: { id: 1, x: 400, y: 400 }, commit: true }, frame)
  assert.equal(end.direction, 0)
  assert.equal(end.swallow, false)
  assert.equal(zoom.transform().scale, 2)
})

test('mouse still steps, pans, and ignores the right button', () => {
  const zoom = gesture()
  const right = zoom.pointerDown({ ...photo, pointerId: 4, pointerType: 'mouse', button: 2, x: 0, y: 0 }, frame)
  assert.equal(right.capture, false)
  assert.deepEqual(zoom.transform(), { scale: 1, x: 0, y: 0 })
  zoom.pointerDown({ ...photo, pointerId: 1, pointerType: 'mouse', button: 0, x: 180, y: 10, backdrop: true }, frame)
  zoom.pointerMove({ pointerId: 1, pointerType: 'mouse', x: 20, y: 12 })
  const end = zoom.pointerUp({ pointerId: 1, pointerType: 'mouse', x: 20, y: 12, commit: true }, frame)
  assert.equal(end.direction, 1)
  assert.equal(end.swallow, true)
  assert.equal(end.prevent, false)

  zoom.touchStart({ ...photo, touches: [{ id: 1, x: -50, y: 0 }, { id: 2, x: 50, y: 0 }] }, frame)
  zoom.touchMove({ touches: [{ id: 1, x: -100, y: 0 }, { id: 2, x: 100, y: 0 }] }, frame)
  zoom.touchEnd({ remaining: [], lifted: { id: 2, x: 100, y: 0 }, commit: true }, frame)
  zoom.pointerDown({ ...photo, pointerId: 1, pointerType: 'mouse', button: 0, x: 0, y: 0 }, frame)
  zoom.pointerMove({ pointerId: 1, pointerType: 'mouse', x: 40, y: -10 })
  assert.equal(zoom.transform().x, 40)
  assert.equal(zoom.transform().y, -10)
  assert.equal(zoom.pointerUp({ pointerId: 1, pointerType: 'mouse', x: 40, y: -10, commit: true }, frame).direction, 0)
})

test('a button press does not pinch, and the grid still scrolls', () => {
  const zoom = gesture()
  const button = zoom.touchStart({ ...photo, control: true, touches: [{ id: 1, x: 0, y: 0 }] }, frame)
  assert.equal(button.prevent, false)
  assert.equal(zoom.transform().scale, 1)
  const both = zoom.touchStart({ ...photo, control: true, touches: [{ id: 1, x: -50, y: 0 }, { id: 2, x: 50, y: 0 }] }, frame)
  assert.equal(both.prevent, true)
  zoom.touchMove({ touches: [{ id: 1, x: -100, y: 0 }, { id: 2, x: 100, y: 0 }] }, frame)
  assert.equal(zoom.transform().scale, 2)
  zoom.resetTransform()
  const grid = zoom.touchStart({ open: true, mode: 'grid', control: false, touches: [{ id: 1, x: 0, y: 0 }] }, frame)
  assert.equal(grid.prevent, false)
  zoom.touchMove({ touches: [{ id: 1, x: -80, y: 0 }] }, frame)
  assert.equal(zoom.touchEnd({ remaining: [], lifted: { id: 1, x: -80, y: 0 }, commit: true }, frame), null)
})

function host() {
  const listeners = []
  return {
    listeners,
    addEventListener(type, fn, options) {
      listeners.push({ type, fn, options: options || {} })
    },
  }
}

function finger(id, x, y) {
  return { identifier: id, clientX: x, clientY: y }
}

function event(type, touches, extra = {}) {
  const record = {
    type,
    cancelable: true,
    target: extra.target || {},
    touches,
    changedTouches: extra.changed || [],
    scale: extra.scale,
    pointerId: extra.pointerId,
    pointerType: extra.pointerType,
    button: extra.button,
    clientX: extra.clientX,
    clientY: extra.clientY,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true },
  }
  return record
}

function find(el, type) {
  return el.listeners.find(listener => listener.type === type)
}

test('phone listeners can cancel the gesture and touch pointers are not captured', () => {
  const dialog = host()
  const doc = host()
  const zoom = gesture()
  const captured = []
  let open = true
  let mode = 'photo'
  attachPhotoGestures(dialog, doc, zoom, {
    open: () => open,
    mode: () => mode,
    isControl: target => Boolean(target?.control),
    isBackdrop: target => Boolean(target?.backdrop),
    frame: () => frame,
    capturePointer: id => captured.push(id),
    apply() {},
  })

  assert.equal(find(dialog, 'touchstart').options.passive, false)
  assert.equal(find(dialog, 'touchmove').options.passive, false)
  assert.equal(find(dialog, 'touchend').options.passive, false)
  assert.equal(find(doc, 'gesturestart').options.passive, false)
  assert.equal(find(doc, 'gesturechange').options.passive, false)
  assert.equal(find(dialog, 'pointerdown').options.passive, true)
  assert.equal(find(doc, 'pointermove').options.passive, true)

  const down = event('touchstart', [finger(1, -50, 0), finger(2, 50, 0)])
  find(doc, 'touchstart').fn(down)
  find(dialog, 'touchstart').fn(down)
  assert.equal(down.defaultPrevented, true)

  find(dialog, 'pointerdown').fn(event('pointerdown', [], {
    pointerId: 7, pointerType: 'touch', button: 0, clientX: -50, clientY: 0,
  }))
  assert.deepEqual(captured, [])

  const move = event('touchmove', [finger(1, -50, 0), finger(2, 50, 0)])
  find(dialog, 'touchmove').fn(move)
  const pinch = event('gesturechange', [], { scale: 2 })
  find(doc, 'gesturechange').fn(pinch)
  assert.equal(pinch.defaultPrevented, true)
  assert.equal(zoom.transform().scale, 2)

  find(doc, 'pointercancel').fn(event('pointercancel', [], {
    pointerId: 7, pointerType: 'touch', clientX: -50, clientY: 0,
  }))
  assert.equal(zoom.transform().scale, 2)

  const spread = event('touchmove', [finger(1, -100, 0), finger(2, 100, 0)])
  find(dialog, 'touchmove').fn(spread)
  assert.equal(spread.defaultPrevented, true)
  assert.equal(zoom.transform().scale, 2)

  const end = event('touchend', [], { changed: [finger(2, 100, 0)] })
  find(dialog, 'touchend').fn(end)
  assert.equal(end.defaultPrevented, true)
  assert.equal(zoom.transform().scale, 2)

  mode = 'grid'
  const gridGesture = event('gesturestart', [])
  find(doc, 'gesturestart').fn(gridGesture)
  assert.equal(gridGesture.defaultPrevented, false)

  open = false
  mode = 'photo'
  const closed = event('gesturestart', [])
  find(doc, 'gesturestart').fn(closed)
  assert.equal(closed.defaultPrevented, false)
})

test('a touch swipe still steps when the pointer stream is cancelled', () => {
  const dialog = host()
  const doc = host()
  const zoom = gesture()
  const steps = []
  attachPhotoGestures(dialog, doc, zoom, {
    open: () => true,
    mode: () => 'photo',
    isControl: () => false,
    isBackdrop: () => false,
    frame: () => frame,
    capturePointer() {},
    apply(result) { if (result?.direction) steps.push(result.direction) },
  })
  find(dialog, 'touchstart').fn(event('touchstart', [finger(1, 180, 20)]))
  find(dialog, 'pointerdown').fn(event('pointerdown', [], {
    pointerId: 1, pointerType: 'touch', button: 0, clientX: 180, clientY: 20,
  }))
  find(dialog, 'touchmove').fn(event('touchmove', [finger(1, 20, 24)]))
  find(doc, 'pointercancel').fn(event('pointercancel', [], {
    pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 24,
  }))
  find(dialog, 'touchend').fn(event('touchend', [], { changed: [finger(1, 20, 24)] }))
  find(doc, 'pointerup').fn(event('pointerup', [], {
    pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 24,
  }))
  assert.deepEqual(steps, [1])
  assert.equal(zoom.transform().scale, 1)
})

test('mouse capture and city swipe stay on pointer events', () => {
  const dialog = host()
  const doc = host()
  const zoom = gesture()
  const captured = []
  const steps = []
  attachPhotoGestures(dialog, doc, zoom, {
    open: () => true,
    mode: () => 'photo',
    isControl: target => Boolean(target?.control),
    isBackdrop: target => Boolean(target?.backdrop),
    frame: () => frame,
    capturePointer: id => captured.push(id),
    apply(result) { if (result?.direction) steps.push(result.direction) },
  })
  find(dialog, 'pointerdown').fn(event('pointerdown', [], {
    pointerId: 3, pointerType: 'mouse', button: 0, clientX: 160, clientY: 30, target: { backdrop: true },
  }))
  assert.deepEqual(captured, [3])
  find(doc, 'pointermove').fn(event('pointermove', [], {
    pointerId: 3, pointerType: 'mouse', clientX: 20, clientY: 34,
  }))
  find(doc, 'pointerup').fn(event('pointerup', [], {
    pointerId: 3, pointerType: 'mouse', clientX: 20, clientY: 34,
  }))
  assert.deepEqual(steps, [1])

  const button = event('touchstart', [finger(1, 0, 0)], { target: { control: true } })
  find(doc, 'touchstart').fn(button)
  find(dialog, 'touchstart').fn(button)
  assert.equal(button.defaultPrevented, false)
  assert.equal(zoom.transform().scale, 1)
})

test('the open photograph is not a scroll container', () => {
  const css = readFileSync(new URL('../photodump.css', import.meta.url), 'utf8')
  assert.match(css, /\.pd-dialog\[data-view="photo"\] \{ touch-action: none; overflow: hidden; \}/)
  assert.match(css, /html:has\(\.pd-dialog\[open\]\[data-view="photo"\]\) \{ touch-action: none; \}/)
})
