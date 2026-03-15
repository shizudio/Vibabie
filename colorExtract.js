// colorExtract.js — colour quantisation & colour utility helpers

/**
 * Extract the top N dominant colours from a loaded image element.
 * Uses a canvas to sample pixels, quantising each channel to 8 levels
 * (step of 32) to produce ~512 possible colour buckets.
 *
 * @param {HTMLImageElement} imgEl  - a fully loaded <img> element
 * @param {number}           topN  - how many top colours to return (default 5)
 * @returns {string[]}             - array of hex colour strings e.g. "#e04040"
 */
export function extractColors(imgEl, topN = 5) {
  const size = 80
  const canvas = document.createElement('canvas')
  canvas.width  = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(imgEl, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)

  // Quantise each channel to 8 levels (step of 32) → 512 possible buckets
  const buckets = {}
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue  // skip transparent pixels
    const r = (data[i]     >> 5) << 5
    const g = (data[i + 1] >> 5) << 5
    const b = (data[i + 2] >> 5) << 5
    const key = `${r},${g},${b}`
    buckets[key] = (buckets[key] || 0) + 1
  }

  return Object.entries(buckets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([key]) => {
      const [r, g, b] = key.split(',').map(Number)
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    })
}

/**
 * Merge multiple per-image colour arrays into a single global palette.
 * Uses a coarser quantisation (step 64) to merge near-identical colours
 * across photos, then returns the topN entries sorted by frequency.
 *
 * @param {string[][]} colorArrays - array of hex-string arrays (one per image)
 * @param {number}     topN        - how many palette entries to return (default 9)
 * @returns {{ hex: string, count: number }[]}
 */
export function aggregatePalette(colorArrays, topN = 9) {
  const pool = {}

  colorArrays.flat().forEach(hex => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    // Coarser quantisation (step 64) merges near-identical colours across photos
    const cr = (r >> 6) << 6
    const cg = (g >> 6) << 6
    const cb = (b >> 6) << 6
    const key = `${cr},${cg},${cb}`
    if (!pool[key]) {
      pool[key] = {
        hex: `#${cr.toString(16).padStart(2, '0')}${cg.toString(16).padStart(2, '0')}${cb.toString(16).padStart(2, '0')}`,
        count: 0
      }
    }
    pool[key].count++
  })

  return Object.values(pool)
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
}

/**
 * Convert a hex colour string to an rgba() CSS value.
 *
 * @param {string} hex    - e.g. "#e04040"
 * @param {number} alpha  - 0–1
 * @returns {string}      - e.g. "rgba(224,64,64,0.5)"
 */
export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
