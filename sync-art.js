#!/usr/bin/env node
// sync-art.js — run `node sync-art.js` after dropping new files into public/Art/
// Scans public/Art (main artworks) and public/Art/Sketches (loose studies),
// then writes art-manifest.json as { artworks: [...], sketches: [...] }.
// Existing entries (matched by src) keep their title / meta / description.

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const PUBLIC_DIR = 'public'
const ART_DIR    = join(PUBLIC_DIR, 'Art')
const SKETCH_DIR = join(ART_DIR, 'Sketches')
const MANIFEST   = join(PUBLIC_DIR, 'art-manifest-v2.json')
const EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

function isImage(f) {
  return EXTS.has(f.slice(f.lastIndexOf('.')).toLowerCase())
}

// List image files in a dir, returning web-relative srcs (served from public/).
function listImages(dir, webPrefix) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(isImage)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map(f => `${webPrefix}/${f}`)
}

// ── Load existing manifest (supports old flat-array shape) ──
let prev = { artworks: [], sketches: [] }
if (existsSync(MANIFEST)) {
  const raw = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  if (Array.isArray(raw)) prev.artworks = raw
  else prev = { artworks: raw.artworks || [], sketches: raw.sketches || [] }
}

const prevBySrc = new Map(
  [...prev.artworks, ...prev.sketches].map(e => [e.src, e])
)

// Merge a list of srcs against previous metadata, preserving order from disk.
function merge(srcs, added) {
  return srcs.map(src => {
    if (prevBySrc.has(src)) return prevBySrc.get(src)
    added.push(src)
    return { src, title: '', meta: '', description: '' }
  })
}

const added = []
const artworks = merge(listImages(ART_DIR, 'Art'), added)
const sketches = merge(listImages(SKETCH_DIR, 'Art/Sketches'), added)

writeFileSync(MANIFEST, JSON.stringify({ artworks, sketches }, null, 2))

console.log(`Wrote ${MANIFEST}: ${artworks.length} artwork(s), ${sketches.length} sketch(es).`)
if (added.length) {
  console.log(`\nAdded ${added.length} new file(s) — fill in title / meta / description:`)
  added.forEach(s => console.log(`  + ${s}`))
}
