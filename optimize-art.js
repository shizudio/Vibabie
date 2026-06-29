#!/usr/bin/env node
// optimize-art.js — generate web-optimized copies of artwork + sketch images
// and repoint art-manifest-v2.json at them. Originals are left untouched as the
// source of truth; optimized WebP copies live under public/Art/web/.
//
// Sizing: 2560px on the long edge (covers a retina lightbox full-view), WebP q82.
// Idempotent: entries already pointing at .webp are skipped.
//
//   node optimize-art.js
//
// Workflow after adding new art: `node sync-art.js` then `node optimize-art.js`.

import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs'
import { join, basename, extname } from 'path'
import sharp from 'sharp'

const PUBLIC   = 'public'
const MANIFEST = join(PUBLIC, 'art-manifest-v2.json')
const WEB_DIR  = join(PUBLIC, 'Art', 'web')
const MAX_EDGE = 2560
const QUALITY  = 82

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

let before = 0, after = 0
console.log('Artworks:')
for (const a of data.artworks) { const r = await optimize(a);            if (r) { before += r.before; after += r.after } }
console.log('Sketches:')
for (const s of data.sketches) { const r = await optimize(s, 'sketches'); if (r) { before += r.before; after += r.after } }

writeFileSync(MANIFEST, JSON.stringify(data, null, 2))

if (before) {
  console.log(`\nTotal: ${mb(before)} → ${mb(after)}  (-${(100 - after / before * 100).toFixed(0)}%)`)
  console.log(`Manifest repointed to Art/web/. Originals kept as source.`)
} else {
  console.log('\nNothing to do — all entries already optimized.')
}
