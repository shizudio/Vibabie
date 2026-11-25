#!/usr/bin/env node
/**
 * add-portrait.js — put a new profile picture at the front of the archive.
 *
 *   node add-portrait.js ~/Desktop/new-photo.jpg
 *   node add-portrait.js ~/Desktop/new.jpg --alt "On the roof in Beijing"
 *   node add-portrait.js ~/Desktop/new.jpg --video ~/Desktop/new.mov
 *
 * What it does: optimises the image, copies it into public/About/portraits/
 * under a dated name, and puts it at the top of public/portrait-manifest.json.
 * The About page reads entry 0, so the new photo IS the portrait from the next
 * load. Nothing is overwritten and nothing is deleted; the previous portrait
 * simply becomes the second item in the archive.
 *
 * The site is static, so this is not live until it is committed and deployed.
 * One command here, one push, about ninety seconds of Vercel build.
 *
 * A video is optional. When present it plays on hover over the portrait, which
 * is the behaviour script.js already gives the frame.
 */

import sharp from 'sharp'
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { basename, extname, join } from 'path'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// Anchor every path on this file, never on the shell's cwd. Run from another
// directory these scripts used to create public/ wherever they were invoked
// and then fail on the manifest, which is a quiet way to scatter files around
// someone's machine. Any agent can now run them from anywhere.
const ROOT = dirname(fileURLToPath(import.meta.url))


const DIR = resolve(ROOT, 'public', 'About', 'portraits')
const MANIFEST = resolve(ROOT, 'public', 'portrait-manifest.json')
const MAX_EDGE = 1400          // the frame renders near 300px wide; this covers retina
const QUALITY = 84

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : null
}

if (!file) {
  console.error('Usage: node add-portrait.js <image|url> [--alt "..."] [--video <file>] [--date YYYY-MM-DD]')
  process.exit(1)
}
/* A URL works as well as a path, and it is the one handoff that works with
   every agent. Pasting an image into a chat often gives the agent vision
   input rather than bytes it can read, so there is no file to point at. Put
   the photo anywhere that serves a URL and hand over the link instead: no
   credentials, no upload endpoint, nothing to keep running. */
let source = file
let tempFile = null
if (/^https?:\/\//i.test(file)) {
  process.stdout.write(`  fetching ${file}\n`)
  const res = await fetch(file)
  if (!res.ok) { console.error(`  ${res.status} ${res.statusText}`); process.exit(1) }

  const type = res.headers.get('content-type') || ''
  if (!/^image\//.test(type)) {
    console.error(`  Not an image: served ${type || 'no content-type'}`)
    process.exit(1)
  }

  const buf = Buffer.from(await res.arrayBuffer())
  const MAX = 25 * 1024 * 1024
  if (buf.length > MAX) {
    console.error(`  ${(buf.length / 1048576).toFixed(1)}MB is larger than the 25MB ceiling`)
    process.exit(1)
  }

  tempFile = join(tmpdir(), `portrait-${Date.now()}`)
  writeFileSync(tempFile, buf)
  source = tempFile
} else if (!existsSync(file)) {
  console.error(`No such file: ${file}`)
  process.exit(1)
}

const date = flag('date') || new Date().toISOString().slice(0, 10)
// Dated, slugged name: the archive sorts and reads sensibly in a file listing,
// and two photos added the same day cannot collide.
const stem = (tempFile ? (flag('alt') || 'portrait') : basename(file, extname(file))).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
let name = `${date}-${stem || 'portrait'}`
let n = 1
while (existsSync(join(DIR, `${name}.webp`))) { name = `${date}-${stem || 'portrait'}-${++n}` }

mkdirSync(DIR, { recursive: true })

const out = join(DIR, `${name}.webp`)
const info = await sharp(source)
  .rotate()                                   // honour EXIF, or phone photos land sideways
  .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
  .webp({ quality: QUALITY })
  .toFile(out)

const entry = {
  src: `/About/portraits/${name}.webp`,
  alt: flag('alt') || '',
  date,
}

const video = flag('video')
if (video) {
  if (!existsSync(video)) { console.error(`No such video: ${video}`); process.exit(1) }
  const vname = `${name}${extname(video).toLowerCase()}`
  copyFileSync(video, join(DIR, vname))
  entry.video = `/About/portraits/${vname}`
}

const data = JSON.parse(readFileSync(MANIFEST, 'utf8'))
data.portraits = data.portraits || []
data.portraits.unshift(entry)
writeFileSync(MANIFEST, JSON.stringify(data, null, 2) + '\n')

if (tempFile) { try { unlinkSync(tempFile) } catch (e) { /* best effort */ } }
console.log(`\n  ${out}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)}KB`)
if (entry.video) console.log(`  ${join(DIR, basename(entry.video))}`)
if (!entry.alt) console.log('\n  No --alt given. Add one in the manifest: it is what a screen reader reads.')
console.log(`\n  Now the portrait. Archive holds ${data.portraits.length}.`)
console.log('  Commit and push to put it live.\n')
