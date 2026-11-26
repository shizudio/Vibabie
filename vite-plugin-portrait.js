/**
 * vite-plugin-portrait.js
 *
 * Writes the CURRENT profile picture into the About page's HTML, so the first
 * paint already shows it.
 *
 * WHY THIS EXISTS. The portrait lives in public/portrait-manifest.json, but
 * about.html is static markup. With nothing here, the markup carried the
 * ORIGINAL portrait and about-portrait.js swapped in the latest one after
 * fetching the manifest, so every visit flashed the previous picture first and
 * then jumped to the new one. Doing the swap at build time means there is
 * nothing left to swap: the image in the HTML is already the right one.
 *
 * WHEN IT RUNS. On every HTML transform, in dev and in the production build,
 * and it reads the manifest fresh each time, so editing the manifest shows up
 * on the next dev reload and on the next deploy. Deploy-based, as chosen:
 * this does not make a portrait change instant, it makes the page honest
 * about which portrait it shipped with.
 *
 * ORDER. 'pre', so it runs before Vite's own asset handling. Without that,
 * Vite sees the relative About/portrait.jpg first and bundles the old file
 * into dist/assets even though nothing would reference it any more.
 *
 * FAILURE IS HARMLESS. A missing or unreadable manifest leaves the markup
 * exactly as written in about.html, which still points at the original
 * portrait, and about-portrait.js still upgrades it at runtime. Worse
 * (a flash), never broken.
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const MANIFEST = join(ROOT, 'public', 'portrait-manifest.json')

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;')

function current() {
  try {
    const first = JSON.parse(readFileSync(MANIFEST, 'utf8')).portraits[0]
    return first && first.src ? first : null
  } catch (e) {
    return null
  }
}

export default function portraitPlugin() {
  return {
    name: 'portrait',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!html.includes('portrait-img')) return html
        const p = current()
        if (!p) return html

        // Above the fold, so no loading="lazy": a lazy image is the last thing
        // the browser fetches, which is the opposite of what the first thing on
        // the page should be. fetchpriority tells it the same.
        html = html.replace(
          /<img\b[^>]*\bclass="portrait-img"[^>]*>/,
          `<img src="${esc(p.src)}" alt="${esc(p.alt || 'Shina Foo')}" class="portrait-img" fetchpriority="high" decoding="async" />`
        )

        // The hover clip is optional. No video in the entry means no src, and
        // script.js, which binds to the element on load, keeps working.
        html = html.replace(
          /<video\b[^>]*\bclass="portrait-vid"[^>]*>/,
          p.video
            ? `<video src="${esc(p.video)}" muted playsinline loop class="portrait-vid">`
            : '<video muted playsinline loop class="portrait-vid">'
        )
        return html
      },
    },
  }
}
