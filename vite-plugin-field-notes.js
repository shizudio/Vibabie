/**
 * vite-plugin-field-notes.js
 *
 * Two jobs, both in service of one promise: adding a Field Note is ONE new
 * file in public/field-notes/ and nothing else. No index to edit, no route to
 * register, no config to touch.
 *
 *   1. INDEX. Globs public/field-notes/*.json and writes index.json, sorted
 *      newest first. Runs on dev-server start, on build, and again whenever a
 *      file in that folder changes, so the index can never drift from what is
 *      on disk. index.json is generated, not authored: it is in .gitignore.
 *
 *   2. DEV ROUTING. Production serves /field-notes/<slug> through a Vercel
 *      rewrite to /field-note.html?slug=<slug>. The dev server knows nothing
 *      about vercel.json, so without this middleware the pretty URL would 404
 *      locally and only work once deployed — exactly the kind of difference
 *      you discover in production. This makes local match live.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIR = join(__dirname, 'public', 'field-notes')
const INDEX = join(DIR, 'index.json')

function buildIndex() {
  if (!existsSync(DIR)) { mkdirSync(DIR, { recursive: true }); return 0 }

  const entries = []
  for (const file of readdirSync(DIR)) {
    if (!file.endsWith('.json') || file === 'index.json') continue
    try {
      const raw = JSON.parse(readFileSync(join(DIR, file), 'utf8'))
      const slug = raw.slug || file.replace(/\.json$/, '')
      // The index carries only what a card renders. The entry page fetches the
      // full file, so prose never has to travel with the listing.
      // Shina's rule for this section: no em dashes in copy or UI. Caught at
      // index time so a stray one is a console warning while writing, not
      // something spotted on the live site later.
      const dashed = []
      const scan = (v, path) => {
        if (typeof v === 'string') { if (v.includes('\u2014')) dashed.push(path) }
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => scan(v[k], path ? path + '.' + k : k))
      }
      scan(raw, '')
      if (dashed.length) {
        console.warn(`[field-notes] ${file}: em dash in ${dashed.join(', ')} (this section bans them)`)
      }

      entries.push({
        slug,
        title: raw.title || slug,
        creator: raw.creator || '',
        creatorUrl: raw.creatorUrl || '',
        hook: raw.hook || '',
        tags: Array.isArray(raw.tags) ? raw.tags : [],
        thumb: raw.thumb || '',
        thumbVideo: raw.thumbVideo || '',
        thumbAlt: raw.thumbAlt || '',
        dateAdded: raw.dateAdded || '',
      })
    } catch (e) {
      // A malformed entry must not take the whole index down with it.
      console.warn(`[field-notes] skipped ${file}: ${e.message}`)
    }
  }

  entries.sort((a, b) => String(b.dateAdded).localeCompare(String(a.dateAdded)))
  writeFileSync(INDEX, JSON.stringify({ entries }, null, 2))
  return entries.length
}

export default function fieldNotesPlugin() {
  return {
    name: 'field-notes',

    buildStart() {
      const n = buildIndex()
      console.log(`[field-notes] indexed ${n} entr${n === 1 ? 'y' : 'ies'}`)
    },

    configureServer(server) {
      buildIndex()

      server.watcher.add(DIR)
      const onChange = (file) => {
        if (!file.startsWith(DIR)) return
        if (file.endsWith('index.json')) return   // our own write, ignore
        buildIndex()
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', onChange)
      server.watcher.on('change', onChange)
      server.watcher.on('unlink', onChange)

      // Mirror the production rewrite so /field-notes/<slug> works in dev.
      server.middlewares.use((req, res, next) => {
        // Extensionless only. An earlier version matched any segment, so a
        // relative request for style.css from the entry page arrived here as
        // /field-notes/style.css and was answered with HTML, which Vite then
        // tried to parse as a module. Eight 500s and a dev-overlay crash.
        const m = req.url && req.url.match(/^\/field-notes\/([A-Za-z0-9_-]+)\/?(?:\?.*)?$/)
        if (m) {
          req.url = `/field-note.html?slug=${encodeURIComponent(m[1])}`
        }
        next()
      })
    },
  }
}
