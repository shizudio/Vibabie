#!/usr/bin/env node
// optimize-art.js — generate web-optimized copies of artwork + sketch images
// and repoint art-manifest-v2.json at them. Originals are left untouched as the
// source of truth; optimized WebP copies live under public/Art/web/.
//
// Sizing: 2560px on the long edge (covers a retina lightbox full-view), WebP q82.
// Also writes a 1200px sibling under Art/web/card/ for the phone carousel.
// Idempotent: entries already pointing at .webp are skipped, and an existing
// card sibling is left untouched.
//
//   node optimize-art.js
//
// Workflow after adding new art: `node sync-art.js` then `node optimize-art.js`.

import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'fs'
import { join, basename, extname, dirname } from 'path'
import sharp from 'sharp'

const PUBLIC   = 'public'
const MANIFEST = join(PUBLIC, 'art-manifest-v2.json')
const WEB_DIR  = join(PUBLIC, 'Art', 'web')
const MAX_EDGE = 2560
const QUALITY  = 82
// Phone carousel + phone lightbox. The 2560px master is what desktop uses;
// art.js swaps in Art/web/card/ below 768px. Long edge covers a 3x phone.
const CARD_EDGE = 1200
const CARD_QUALITY = 78

const data = JSON.parse(readFileSync(MANIFEST, 'utf8'))
mkdirSync(join(WEB_DIR, 'sketches'), { recursive: true })

const mb = n => (n / 1048576).toFixed(2) + 'MB'

async function optimize(entry, subdir = '') {
  if (entry.src.toLowerCase().endsWith('.webp')) return null   // already optimized
  const input = join(PUBLIC, entry.src)
  const name  = basename(entry.src, extname(entry.src)) + '.webp'
  const outRel = join('Art', 'web', subdir, name)
  const output = join(PUBLIC, outRel)

  await sharp(input)
    .rotate()                                                   // honour EXIF orientation
    .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(output)

  const before = statSync(input).size
  const after  = statSync(output).size
  console.log(`  ${entry.src}  ${mb(before)} → ${mb(after)}  (-${(100 - after / before * 100).toFixed(0)}%)`)
  entry.src = outRel.split('\\').join('/')                      // web path, forward slashes
  return { before, after }
}

// 1200px sibling for the phone deck. Skipped when the file is already there,
// so a later run doesn't re-encode and churn the committed copies.
async function ensureCard(srcRel) {
  if (!srcRel) return
  const rel = srcRel.split('\\').join('/')
  if (!rel.includes('Art/web/') || rel.includes('/card/')) return
  const cardRel = rel.replace('Art/web/', 'Art/web/card/')
  const output = join(PUBLIC, cardRel)
  if (existsSync(output)) return
  const input = join(PUBLIC, rel)
  if (!existsSync(input)) return
  mkdirSync(dirname(output), { recursive: true })
  await sharp(input)
    .rotate()
    .resize(CARD_EDGE, CARD_EDGE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: CARD_QUALITY })
    .toFile(output)
  console.log(`  card ${cardRel}`)
}

let before = 0, after = 0
console.log('Artworks:')
for (const a of data.artworks) { const r = await optimize(a);            if (r) { before += r.before; after += r.after } }
console.log('Sketches:')
for (const s of data.sketches) { const r = await optimize(s, 'sketches'); if (r) { before += r.before; after += r.after } }

console.log('Card copies (phone carousel, 1200px):')
for (const a of data.artworks) {
  await ensureCard(a.src)
  await ensureCard(a.beforeSrc)
}
for (const s of data.sketches) await ensureCard(s.src)

writeFileSync(MANIFEST, JSON.stringify(data, null, 2))

if (before) {
  console.log(`\nTotal: ${mb(before)} → ${mb(after)}  (-${(100 - after / before * 100).toFixed(0)}%)`)
  console.log(`Manifest repointed to Art/web/. Originals kept as source.`)
} else {
  console.log('\nNothing to do — all entries already optimized.')
}
