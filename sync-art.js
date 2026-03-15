#!/usr/bin/env node
// sync-art.js — run `node sync-art.js` after dropping new files into Art/
// Adds any new images to art-manifest.json with placeholder fields.
// Existing entries (matched by src) are preserved as-is.

import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const ART_DIR = 'Art'
const MANIFEST = 'art-manifest.json'
const EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

const files = readdirSync(ART_DIR)
  .filter(f => EXTS.has(f.slice(f.lastIndexOf('.')).toLowerCase()))
  .map(f => `${ART_DIR}/${f}`)

const existing = JSON.parse(readFileSync(MANIFEST, 'utf8'))
const existingSrcs = new Set(existing.map(e => e.src))

const added = []
for (const src of files) {
  if (!existingSrcs.has(src)) {
    existing.push({ src, title: '', meta: '', description: '' })
    added.push(src)
  }
}

writeFileSync(MANIFEST, JSON.stringify(existing, null, 2))

if (added.length) {
  console.log(`Added ${added.length} new file(s) to ${MANIFEST}:`)
  added.forEach(s => console.log(`  + ${s}`))
  console.log('\nFill in title, meta, and description for each new entry.')
} else {
  console.log('art-manifest.json is already up to date.')
}
