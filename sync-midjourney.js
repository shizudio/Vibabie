#!/usr/bin/env node
// sync-midjourney.js
//
// Drop images into Midjourney/ then run:
//   node sync-midjourney.js
//
// Requires: ANTHROPIC_API_KEY env var (or set in .env)
// Installs:  npm install @anthropic-ai/sdk dotenv
//
// What it does:
//   1. Scans Midjourney/ for new image files
//   2. For each new image, sends it to Claude vision to auto-detect tags
//   3. Appends new entries to midjourney-manifest.json
//   4. Existing entries are never overwritten

const fs      = require('fs')
const path    = require('path')
const Anthropic = require('@anthropic-ai/sdk')

// ── Config ───────────────────────────────────────────────────────────────────
const MJ_DIR   = 'Midjourney'
const MANIFEST = 'midjourney-manifest.json'
const EXTS     = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

const VALID_TAGS = [
  'crimson', 'purple', 'green',
  'shiba', 'astronauts', 'cats', 'model', 'others'
]

// ── Load manifest ─────────────────────────────────────────────────────────────
const manifest   = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
const existingSrcs = new Set(manifest.images.map(e => e.src))

// ── Find new images ───────────────────────────────────────────────────────────
const newFiles = fs.readdirSync(MJ_DIR)
  .filter(f => EXTS.has(path.extname(f).toLowerCase()))
  .map(f => path.join(MJ_DIR, f).replace(/\\/g, '/'))
  .filter(src => !existingSrcs.has(src))

if (!newFiles.length) {
  console.log('midjourney-manifest.json is already up to date.')
  process.exit(0)
}

console.log(`Found ${newFiles.length} new image(s). Auto-tagging with Claude vision…\n`)

// ── Claude client ─────────────────────────────────────────────────────────────
const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) {
  console.error('Error: ANTHROPIC_API_KEY is not set.')
  console.error('Export it in your shell or add it to a .env file.\n')
  console.error('Falling back to "others" tag for all new images.\n')
}

const client = apiKey ? new Anthropic({ apiKey }) : null

// ── Filename heuristic fallback ───────────────────────────────────────────────
function tagsFromFilename(filePath) {
  const name = path.basename(filePath).toLowerCase()
  const tags = []
  if (/astronaut/.test(name))                                        tags.push('astronauts')
  if (/\bcat[_\s]|\bcats\b/.test(name))                             tags.push('cats')
  if (/shiba/.test(name))                                            tags.push('shiba')
  if (/model|editorial.*female|ethereal.*woman|dazed/.test(name))   tags.push('model')
  return tags.length ? tags : ['others']
}

// ── Tag one image via Claude vision ──────────────────────────────────────────
async function detectTags(filePath) {
  if (!client) return tagsFromFilename(filePath)

  const ext      = path.extname(filePath).slice(1).toLowerCase()
  const mimeType = ext === 'jpg' ? 'image/jpeg'
                 : ext === 'png' ? 'image/png'
                 : ext === 'webp' ? 'image/webp'
                 : ext === 'gif' ? 'image/gif'
                 : 'image/jpeg'

  const imageData = fs.readFileSync(filePath).toString('base64')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 64,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeType, data: imageData }
        },
        {
          type: 'text',
          text: `Look at this image and assign it one or more tags from this list ONLY:
${VALID_TAGS.join(', ')}

Tag rules:
- crimson  → dominant red / burgundy / warm dark palette
- purple   → dominant purple / indigo / violet palette
- green    → dominant green / sage / earthy palette
- shiba    → contains a Shiba Inu dog
- astronauts → contains an astronaut or spacesuit
- cats     → contains a cat
- model    → contains a human figure / portrait / person
- others   → anything that doesn't clearly fit the above

Respond with ONLY a JSON array of matching tag strings. Example: ["astronauts","purple"]
Multiple tags are allowed. Always include at least one tag.`
        }
      ]
    }]
  })

  try {
    const raw  = message.content[0].text.trim()
    const tags = JSON.parse(raw)
    const valid = tags.filter(t => VALID_TAGS.includes(t))
    return valid.length ? valid : ['others']
  } catch {
    return ['others']
  }
}

// ── Process new images ────────────────────────────────────────────────────────
async function run() {
  const added = []

  for (const src of newFiles) {
    process.stdout.write(`  Tagging ${src} … `)
    const tags = await detectTags(src)
    const entry = { src, prompt: '', tags }
    manifest.images.push(entry)
    added.push({ src, tags })
    console.log(`[${tags.join(', ')}]`)
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2))

  console.log(`\nAdded ${added.length} image(s) to ${MANIFEST}.`)
  console.log('Open the manifest to add prompts for each new entry if you like.\n')
}

run().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
