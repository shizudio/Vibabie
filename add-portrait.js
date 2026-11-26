#!/usr/bin/env node
/**
 * add-portrait.js — manage the profile picture on the About landing.
 *
 * ADD a new picture (it becomes the portrait; the old one moves into the archive):
 *
 *   node add-portrait.js ~/Desktop/new-photo.jpg --alt "On the roof in Beijing"
 *   node add-portrait.js https://example.com/me.jpg --alt "..."
 *   node add-portrait.js ~/Desktop/new.jpg --alt "..." --video ~/Desktop/new.mov
 *
 * ATTACH a hover video to a picture that already exists (the usual case when the
 * photo arrives first and its Live Photo clip comes later):
 *
 *   node add-portrait.js --attach-video ~/Desktop/IMG_8874.mov
 *   node add-portrait.js --attach-video https://example.com/clip.mov --to 2026-09-20 --force
 *
 *   --to <n|date>   which entry; 0-based index or its date. Default 0, the current one.
 *   --force         replace a video the entry already has.
 *
 * Optimises the image, files it under a dated name in public/About/portraits/,
 * and writes public/portrait-manifest.json. The About page is built from entry
 * 0 (see vite-plugin-portrait.js). Nothing is overwritten or deleted, so the
 * previous portrait simply becomes the second item in the archive.
 *
 * The site is static: nothing here is live until it is committed and deployed.
 *
 * THE HOVER VIDEO IS OPTIONAL. A portrait with no video simply has no hover
 * effect, and that is a normal state, not a fault. The script says so when it
 * happens, because it is easy to swap in a new photo and not realise the clip
 * belonged to the old one.
 *
 * Videos are converted, not copied: muted H.264 MP4, 720px wide at most, with
 * the index at the front of the file so it starts playing before it has all
 * arrived. A Live Photo's .mov is frequently HEVC, which a lot of browsers will
 * not play, and the frame renders around 300px wide so the original resolution
 * is wasted bytes. Needs ffmpeg; without it only a ready-made .mp4 or .webm is
 * accepted, copied as it is.
 */

import sharp from 'sharp'
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, unlinkSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { spawnSync } from 'child_process'
import { basename, extname, join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

// Anchor every path on this file, never on the shell's cwd. Run from another
// directory these scripts used to create public/ wherever they were invoked
// and then fail on the manifest, which is a quiet way to scatter files around
// someone's machine. Any agent can now run them from anywhere.
const ROOT = dirname(fileURLToPath(import.meta.url))

const DIR = resolve(ROOT, 'public', 'About', 'portraits')
const MANIFEST = resolve(ROOT, 'public', 'portrait-manifest.json')
const MAX_EDGE = 1400          // the frame renders near 300px wide; this covers retina
const QUALITY = 84
const VIDEO_MAX_W = 720
const VIDEO_MAX_BYTES = 100 * 1024 * 1024
const IMAGE_MAX_BYTES = 25 * 1024 * 1024

/* ── Arguments ──────────────────────────────────────────────────────────────
   Positional arguments are what is left once flags and their values are
   removed. The first version took "the first thing without a leading --",
   which breaks as soon as a flag's value comes first: `--attach-video clip.mov`
   would have been read as the image. */
const BOOLEAN = new Set(['force'])
const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  if (i < 0 || BOOLEAN.has(name)) return null
  const v = args[i + 1]
  return v == null || v.startsWith('--') ? null : v
}
const has = (name) => args.includes(`--${name}`)
const positional = () => {
  const out = []
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) { if (!BOOLEAN.has(args[i].slice(2))) i++ }
    else out.push(args[i])
  }
  return out
}

const fail = (msg) => { console.error(`\n  ${msg}\n`); process.exit(1) }
const isUrl = (s) => /^https?:\/\//i.test(s)
const mb = (n) => `${(n / 1048576).toFixed(1)}MB`

const readManifest = () => {
  const data = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  data.portraits = data.portraits || []
  return data
}
const writeManifest = (data) => writeFileSync(MANIFEST, JSON.stringify(data, null, 2) + '\n')

/* ── Getting bytes from a path or a URL ─────────────────────────────────────
   A URL works anywhere a path does, and it is the one handoff that works with
   every agent: pasting a file into a chat often gives an agent something it can
   look at but not bytes it can read, so there is no path to give. Put the file
   anywhere that serves a link and hand over the link instead. */
const temps = []
const cleanup = () => { for (const t of temps) { try { unlinkSync(t) } catch (e) { /* best effort */ } } }
process.on('exit', cleanup)

async function localCopy(input, kind, maxBytes) {
  if (!isUrl(input)) {
    if (!existsSync(input)) fail(`No such file: ${input}`)
    return input
  }
  process.stdout.write(`  fetching ${input}\n`)
  const res = await fetch(input)
  if (!res.ok) fail(`${res.status} ${res.statusText}`)
  const type = res.headers.get('content-type') || ''
  if (!type.startsWith(`${kind}/`)) {
    fail(`Not a ${kind}: that link served ${type || 'no content-type'}. Some hosts hand back a preview page rather than the file; use the direct-download form of the link.`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > maxBytes) fail(`${mb(buf.length)} is over the ${mb(maxBytes)} ceiling`)
  const tmp = join(tmpdir(), `portrait-${kind}-${Date.now()}`)
  writeFileSync(tmp, buf)
  temps.push(tmp)
  return tmp
}

/* ── Video ──────────────────────────────────────────────────────────────── */

const hasFfmpeg = () => !spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).error

/** Converts `input` (path or URL) into outFile. Returns facts about the result. */
async function prepareVideo(input, outFile) {
  const src = await localCopy(input, 'video', VIDEO_MAX_BYTES)
  mkdirSync(dirname(outFile), { recursive: true })

  if (hasFfmpeg()) {
    const r = spawnSync('ffmpeg', [
      '-y', '-v', 'error', '-i', src,
      '-map', '0:v:0', '-an',                                  // first video stream only, no sound
      '-vf', `scale='min(${VIDEO_MAX_W},iw)':-2`,              // never upscale; keep height even
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',                               // playable before it has all arrived
      outFile,
    ], { encoding: 'utf8' })
    if (r.status !== 0) fail(`ffmpeg could not convert that video:\n${(r.stderr || '').trim()}`)
  } else {
    const ext = extname(src.split('?')[0]).toLowerCase()
    const given = isUrl(input) ? extname(new URL(input).pathname).toLowerCase() : ext
    if (given !== '.mp4' && given !== '.webm') {
      fail('ffmpeg is not installed, and only a ready-made .mp4 or .webm can be used without it. A Live Photo .mov usually needs converting: install ffmpeg (brew install ffmpeg) and run this again.')
    }
    copyFileSync(src, outFile)
    console.log('  ffmpeg not found: copied as it is, not resized and not checked for browser support.')
  }

  const bytes = statSync(outFile).size
  let detail = ''
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration', '-of', 'csv=p=0', outFile], { encoding: 'utf8' })
  if (!probe.error && probe.status === 0) {
    const nums = probe.stdout.trim().split(/[\n,]/).map(Number).filter((n) => !Number.isNaN(n))
    if (nums.length >= 3) {
      detail = `${nums[0]}x${nums[1]}, ${nums[2].toFixed(1)}s`
      if (nums[2] > 6) console.log(`  Note: ${nums[2].toFixed(1)}s is long for a hover clip. A couple of seconds loops better.`)
    }
  }
  if (bytes > 3 * 1024 * 1024) console.log(`  Note: ${mb(bytes)} is heavy for something that loads on every visit.`)
  return { bytes, detail }
}

/* ── ATTACH mode ────────────────────────────────────────────────────────── */

if (has('attach-video')) {
  const input = flag('attach-video')
  if (!input) fail('Usage: node add-portrait.js --attach-video <file|url> [--to <index|date>] [--force]')

  const data = readManifest()
  if (!data.portraits.length) fail('The archive is empty. Add a picture first.')

  const to = flag('to') ?? '0'
  let idx
  if (/^\d+$/.test(to)) idx = Number(to)
  else {
    const hits = data.portraits.map((p, i) => (p.date === to ? i : -1)).filter((i) => i >= 0)
    if (hits.length > 1) fail(`${hits.length} pictures share the date ${to}. Use an index: ${hits.join(', ')}.`)
    idx = hits.length ? hits[0] : -1
  }
  const entry = data.portraits[idx]
  if (!entry) fail(`No picture "${to}". The archive has ${data.portraits.length}, indexed 0 to ${data.portraits.length - 1}.`)

  if (entry.video && !has('force')) {
    fail(`${basename(entry.src)} already has a hover video (${basename(entry.video)}). Pass --force to replace it.`)
  }

  const out = join(DIR, `${basename(entry.src, extname(entry.src))}.mp4`)
  const info = await prepareVideo(input, out)
  const previous = entry.video
  entry.video = `/About/portraits/${basename(out)}`
  writeManifest(data)

  console.log(`\n  ${out}  ${info.detail}  ${mb(info.bytes)}`)
  console.log(`  Attached to entry ${idx} (${entry.date}). Hovering that portrait now plays it.`)
  if (previous && previous !== entry.video) console.log(`  The previous clip (${basename(previous)}) is no longer referenced but was not deleted.`)
  console.log('  Commit and push to put it live.\n')
  process.exit(0)
}

/* ── ADD mode ───────────────────────────────────────────────────────────── */

const [file] = positional()
if (!file) {
  fail('Usage: node add-portrait.js <image|url> [--alt "..."] [--video <file|url>] [--date YYYY-MM-DD]\n     or: node add-portrait.js --attach-video <file|url> [--to <index|date>] [--force]')
}

const source = await localCopy(file, 'image', IMAGE_MAX_BYTES)
const remote = isUrl(file)

const date = flag('date') || new Date().toISOString().slice(0, 10)
// Dated, slugged name: the archive sorts and reads sensibly in a file listing,
// and two photos added the same day cannot collide.
const stem = (remote ? (flag('alt') || 'portrait') : basename(file, extname(file)))
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
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

let videoInfo = null
if (flag('video')) {
  const vout = join(DIR, `${name}.mp4`)
  videoInfo = await prepareVideo(flag('video'), vout)
  entry.video = `/About/portraits/${name}.mp4`
}

const data = readManifest()
data.portraits.unshift(entry)
writeManifest(data)

console.log(`\n  ${out}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)}KB`)
if (videoInfo) console.log(`  ${join(DIR, basename(entry.video))}  ${videoInfo.detail}  ${mb(videoInfo.bytes)}`)
if (!entry.alt) console.log('\n  No --alt given. Add one in the manifest: it is what a screen reader reads.')
if (!entry.video) {
  const prev = data.portraits[1]
  console.log('\n  No --video given, so hovering this portrait does nothing. That is fine if there is no clip.')
  if (prev && prev.video) console.log(`  Note the previous portrait HAD one (${basename(prev.video)}); it stays with that picture in the archive.`)
  console.log('  If there is a Live Photo or clip for it later: node add-portrait.js --attach-video <file|url>')
}
console.log(`\n  Now the portrait. Archive holds ${data.portraits.length}.`)
console.log('  Commit and push to put it live.\n')
