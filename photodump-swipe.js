// Horizontal gallery step for the open photograph.
// A vertical or shallow gesture returns 0 so the browser keeps native scrolling.
export function galleryStep(dx, dy, threshold = 48) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(threshold)) return 0
  if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return 0
  return dx < 0 ? 1 : -1
}
