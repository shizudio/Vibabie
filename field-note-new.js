#!/usr/bin/env node
/**
 * field-note-new.js — scaffold a Field Note from a link, then fill it in.
 *
 * Two modes, because a note is written in two passes.
 *
 * SCAFFOLD. Everything a machine can know, filled in from the page itself:
 *
 *   node field-note-new.js --url https://example.com/thing \
 *     --title "Thing" --creator "Someone" --creator-url https://someone.com \
 *     --stack "One HTML file, three.js, vanilla JS" \
 *     --hook "One line on what it does." \
 *     --thumb /path/to/screenshot.png
 *
 * The six prose sections are left EMPTY on purpose. This section exists to
 * show how Shina sees, so an agent filling those in would defeat the point of
 * having it. The scaffold removes the drudgery and stops there.
 *
 * FILL. The answers, once she has given them:
 *
 *   node field-note-new.js --fill thing \
 *     --special "..." --trick "..." --alive "..." --steal "..."
 *
 * Passing text through here rather than hand-editing the json avoids escaping
 * mistakes in long quotes and keeps the em dash check on every write.
 *
 * Either mode leaves public/field-notes-data/<slug>.json ready; the index is
 * rebuilt by vite-plugin-field-notes.js on the next request or build.
 */

import sharp from 'sharp'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// Anchor every path on this file, never on the shell's cwd. Run from another
// directory these scripts used to create public/ wherever they were invoked
// and then fail on the manifest, which is a quiet way to scatter files around
// someone's machine. Any agent can now run them from anywhere.
const ROOT = dirname(fileURLToPath(import.meta.url))


const DATA = resolve(ROOT, 'public', 'field-notes-data')
const MEDIA = resolve(ROOT, 'public', 'field-notes-media')
const SECTIONS = ['what', 'special', 'trick', 'alive', 'stack', 'steal']

const args = process.argv.slice(2)
const flag = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null }
const has = (n) => args.includes(`--${n}`)

const slugify = (s) => String(s).toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/* Shina's rule for this section: no em dashes in copy or UI. Checked on every
   write so a stray one never reaches the page. */
function checkDashes(obj, where = '') {
  const found = []
  const walk = (v, path) => {
    if (typeof v === 'string') { if (v.includes('—')) found.push(path) }
    else if (v && typeof v === 'object') Object.keys(v).forEach((k) => walk(v[k], path ? `${path}.${k}` : k))
  }
  walk(obj, where)
  if (found.length) {
    console.warn(`\n  Em dash in ${found.join(', ')}. This section bans them; fix before publishing.`)
  }
}

const QUESTIONS = [
  ['special', 'Why it feels special', 'What did you feel the first time you used it? Name the moment, not the feature.'],
  ['trick',   'The key trick',        'What is the one technique holding it up? (I will propose one from the source; correct me.)'],
  ['alive',   'Why so special',       'What makes the motion feel alive rather than mechanical?'],
  ['steal',   'Steal this',           'Where would you use this idea in your own work?'],
]

/* ── Fill mode ──────────────────────────────────────────────────────────── */

if (has('fill')) {
  const slug = flag('fill')
  const file = join(DATA, `${slug}.json`)
  if (!existsSync(file)) { console.error(`No note at ${file}`); process.exit(1) }

  const note = JSON.parse(readFileSync(file, 'utf8'))
  note.sections = note.sections || {}
  let n = 0
  for (const key of SECTIONS) {
    const v = flag(key)
    if (v != null) { note.sections[key] = v; n++ }
  }
  if (flag('hook')) { note.hook = flag('hook'); n++ }

  checkDashes(note, slug)
  writeFileSync(file, JSON.stringify(note, null, 2) + '\n')

  const empty = SECTIONS.filter((k) => !(note.sections[k] || '').trim())
  console.log(`\n  ${file}: ${n} field${n === 1 ? '' : 's'} written.`)
  console.log(empty.length ? `  Still empty: ${empty.join(', ')}\n` : '  All six sections filled.\n')
  process.exit(0)
}

/* ── Scaffold mode ──────────────────────────────────────────────────────── */

const url = flag('url')
if (!url) {
  console.error('Usage: node field-note-new.js --url <projectUrl> [--title ...] [--creator ...] [--thumb <file>]')
  console.error('   or: node field-note-new.js --fill <slug> --special "..." --trick "..."')
  process.exit(1)
}

const title = flag('title') || new URL(url).hostname.replace(/^www\./, '')
const slug = flag('slug') || slugify(title)

mkdirSync(DATA, { recursive: true })
const file = join(DATA, `${slug}.json`)
if (existsSync(file) && !has('force')) {
  console.error(`${file} already exists. Pass --force to overwrite, or use --fill ${slug}.`)
  process.exit(1)
}

const note = {
  title,
  creator: flag('creator') || '',
  creatorUrl: flag('creator-url') || '',
  projectUrl: url,
  dateAdded: flag('date') || new Date().toISOString().slice(0, 10),
  tags: flag('tags') ? flag('tags').split(',').map((t) => t.trim()).filter(Boolean) : [],
  thumb: '',
  thumbVideo: '',
  thumbAlt: flag('thumb-alt') || '',
  hook: flag('hook') || '',
  sections: Object.fromEntries(SECTIONS.map((k) => [k, k === 'stack' ? (flag('stack') || '') : ''])),
}

// The thumbnail is a capture of the live page, not a file taken from it.
const thumb = flag('thumb')
if (thumb) {
  if (!existsSync(thumb)) { console.error(`No such file: ${thumb}`); process.exit(1) }
  mkdirSync(MEDIA, { recursive: true })
  const out = join(MEDIA, `${slug}.webp`)
  const info = await sharp(thumb)
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 84 })
    .toFile(out)
  note.thumb = `/field-notes-media/${slug}.webp`
  console.log(`\n  thumbnail  ${out}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)}KB`)
}

checkDashes(note, slug)
writeFileSync(file, JSON.stringify(note, null, 2) + '\n')

console.log(`  scaffold   ${file}`)
console.log(`  url        /field-notes/${slug}`)
if (!note.creator) console.log('\n  No --creator given. Credit is not optional in this section; add it.')

console.log('\n  Six sections, and the four that need Shina:\n')
for (const [key, label, q] of QUESTIONS) {
  console.log(`    ${label}  (${key})`)
  console.log(`      ${q}\n`)
}
console.log(`  Then: node field-note-new.js --fill ${slug} --special "..." --trick "..." --alive "..." --steal "..."\n`)
