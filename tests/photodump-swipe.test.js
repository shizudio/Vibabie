import test from 'node:test'
import assert from 'node:assert/strict'
import { galleryStep } from '../photodump-swipe.js'

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
