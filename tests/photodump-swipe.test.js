import test from 'node:test'
import assert from 'node:assert/strict'
import { clampPhotoPan, galleryStep, panBy, photoScale, pinchPan, releaseStep, settleScale } from '../photodump-swipe.js'

test('a horizontal swipe steps to the next or previous photograph', () => {
  assert.equal(galleryStep(-80, 4), 1)
  assert.equal(galleryStep(80, -6), -1)
  assert.equal(galleryStep(-48, 0), 1)
  assert.equal(galleryStep(48, 0), -1)
})

test('vertical scrolling and short or diagonal drags do not step', () => {
  assert.equal(galleryStep(0, 120), 0)
  assert.equal(galleryStep(12, 90), 0)
  assert.equal(galleryStep(47, 0), 0)
  assert.equal(galleryStep(-47, 10), 0)
  assert.equal(galleryStep(80, 80), 0)
  assert.equal(galleryStep(80, -80), 0)
  assert.equal(galleryStep(Number.NaN, 20), 0)
  assert.equal(galleryStep(90, Number.POSITIVE_INFINITY), 0)
})

test('pinch scale follows the distance between two fingers and stays in range', () => {
  assert.equal(photoScale(1, 100, 200), 2)
  assert.equal(photoScale(2, 80, 40), 1)
  assert.equal(photoScale(1, 100, 900), 4)
  assert.equal(photoScale(3, 100, 10), 1)
  assert.equal(photoScale(2, 0, 40), 2)
  assert.equal(photoScale(Number.NaN, 100, 200), 1)
})

test('a small pinch settles back to 1x and a real one stays', () => {
  assert.equal(settleScale(1), 1)
  assert.equal(settleScale(1.02), 1)
  assert.equal(settleScale(1.03), 1.03)
  assert.equal(settleScale(8), 4)
  assert.equal(settleScale(Number.NaN), 1)
})

test('pinch keeps the point between the fingers still', () => {
  assert.deepEqual(pinchPan({
    startPan: { x: 0, y: 0 },
    startFocal: { x: 80, y: -20 },
    focal: { x: 80, y: -20 },
    startScale: 1,
    scale: 2,
  }), { x: -80, y: 20 })
  assert.deepEqual(pinchPan({
    startPan: { x: 0, y: 0 },
    startFocal: { x: 80, y: -20 },
    focal: { x: 100, y: -20 },
    startScale: 1,
    scale: 2,
  }), { x: -60, y: 20 })
  assert.deepEqual(pinchPan({
    startPan: { x: 0, y: 0 },
    startFocal: { x: 40, y: 10 },
    focal: { x: 40, y: 10 },
    startScale: 2,
    scale: 1,
  }), { x: 0, y: 0 })
})

test('one finger pans only while zoomed, and not past the photograph', () => {
  assert.deepEqual(panBy({ x: 10, y: -4 }, 6, 3, 2), { x: 16, y: -1 })
  assert.deepEqual(panBy({ x: 10, y: -4 }, 80, 0, 1), { x: 0, y: 0 })
  assert.deepEqual(clampPhotoPan({ x: 400, y: -400 }, 2, 200, 100), { x: 100, y: -50 })
  assert.deepEqual(clampPhotoPan({ x: 40, y: 10 }, 1, 200, 100), { x: 0, y: 0 })
  assert.deepEqual(clampPhotoPan({ x: 10, y: 10 }, 2, 0, 100), { x: 0, y: 0 })
})

test('a zoomed or pinched photograph does not step the gallery', () => {
  assert.equal(releaseStep(1, -80, 4, false), 1)
  assert.equal(releaseStep(1, 80, 0, false), -1)
  assert.equal(releaseStep(1, 10, 0, false), 0)
  assert.equal(releaseStep(2, -200, 0, false), 0)
  assert.equal(releaseStep(1.03, -200, 0, false), 0)
  assert.equal(releaseStep(1, -200, 0, true), 0)
  assert.equal(releaseStep(1.01, -80, 0, false), 1)
})
