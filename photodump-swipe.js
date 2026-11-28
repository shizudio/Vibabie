// Gestures on an open photograph.
// At 1x, a horizontal swipe steps through the city. A vertical or diagonal
// gesture returns 0 so it does not change photographs.
// Pinch changes scale between 1 and 4. While the photograph is zoomed, one
// finger pans it and does not step the gallery, including at the edge.
// Pinch closed again, then swipe. Previous, Next, and the arrow keys still
// change photographs and the viewer resets to 1x for the next one.

export const PHOTO_MIN_SCALE = 1
export const PHOTO_MAX_SCALE = 4
// A pinch that barely leaves 1x settles back so the next swipe still steps.
export const PHOTO_SCALE_SNAP = 1.02

export function galleryStep(dx, dy, threshold = 48) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(threshold)) return 0
  if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return 0
  return dx < 0 ? 1 : -1
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function photoScale(startScale, startDistance, distance, min = PHOTO_MIN_SCALE, max = PHOTO_MAX_SCALE) {
  const start = Number.isFinite(startScale) ? clamp(startScale, min, max) : min
  if (!Number.isFinite(startScale) || !(startDistance > 0) || !Number.isFinite(distance)) return start
  return clamp(start * (distance / startDistance), min, max)
}

export function settleScale(scale) {
  if (!Number.isFinite(scale) || scale <= PHOTO_SCALE_SNAP) return PHOTO_MIN_SCALE
  return Math.min(PHOTO_MAX_SCALE, scale)
}

// Focal points are offsets from the photograph's layout center, in screen pixels.
// The point under the fingers stays under them as the scale changes.
export function pinchPan({ startPan, startFocal, focal, startScale, scale }) {
  if (!(scale > PHOTO_MIN_SCALE) || !(startScale > 0) || !startPan || !startFocal || !focal) return { x: 0, y: 0 }
  if (![startPan.x, startPan.y, startFocal.x, startFocal.y, focal.x, focal.y].every(Number.isFinite)) return { x: 0, y: 0 }
  return {
    x: focal.x - ((startFocal.x - startPan.x) / startScale) * scale,
    y: focal.y - ((startFocal.y - startPan.y) / startScale) * scale,
  }
}

export function panBy(origin, dx, dy, scale) {
  if (!(scale > PHOTO_MIN_SCALE) || !origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y) || !Number.isFinite(dx) || !Number.isFinite(dy)) return { x: 0, y: 0 }
  return { x: origin.x + dx, y: origin.y + dy }
}

export function clampPhotoPan(pan, scale, width, height) {
  if (!(scale > PHOTO_MIN_SCALE) || !(width > 0) || !(height > 0) || !pan || !Number.isFinite(pan.x) || !Number.isFinite(pan.y)) return { x: 0, y: 0 }
  const maxX = (width * (scale - 1)) / 2
  const maxY = (height * (scale - 1)) / 2
  return { x: clamp(pan.x, -maxX, maxX), y: clamp(pan.y, -maxY, maxY) }
}

// pinched: the gesture used two fingers, so a sideways drift must not change photographs.
export function releaseStep(scale, dx, dy, pinched = false) {
  if (pinched || settleScale(scale) !== PHOTO_MIN_SCALE) return 0
  return galleryStep(dx, dy)
}
