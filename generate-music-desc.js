#!/usr/bin/env node
/**
 * generate-music-desc.js
 * Uses Claude to generate a brief, poetic description of the user's music taste
 * based on the current spotify-data.json playlist.
 *
 * Outputs public/music-description.json with the generated text.
 * Designed to run weekly via a shell profile hook.
 *
 * Requires ANTHROPIC_API_KEY environment variable.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import Anthropic from '@anthropic-ai/sdk'

const SPOTIFY_FILE = './public/spotify-data.json'
const OUT_FILE     = './public/music-description.json'

function loadExisting() {
  if (existsSync(OUT_FILE)) {
    try { return JSON.parse(readFileSync(OUT_FILE, 'utf8')) } catch {}
  }
  return null
}

async function main() {
  console.log('[music-desc] Generating music taste description…')

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('[music-desc] Missing ANTHROPIC_API_KEY — skipping')
    process.exit(0)
  }

  if (!existsSync(SPOTIFY_FILE)) {
    console.warn('[music-desc] No spotify-data.json found — skipping')
    process.exit(0)
  }

  const data = JSON.parse(readFileSync(SPOTIFY_FILE, 'utf8'))
  if (!data.tracks?.length) {
    console.warn('[music-desc] No tracks in playlist — skipping')
    process.exit(0)
  }

  // Build a compact track summary for the prompt
  const trackSummary = data.tracks
    .map(t => `${t.artist} — ${t.name}`)
    .join('\n')

  const client = new Anthropic()

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Here is someone's Spotify playlist (${data.tracks.length} tracks):\n\n${trackSummary}\n\nWrite a 2-3 sentence poetic description of their music taste for their personal portfolio website. Be warm and evocative, not clinical. Don't list artist names — capture the feeling and atmosphere instead. Write in third person ("she listens to..." or "her playlist..."). Keep it under 50 words.`
    }]
  })

  const description = message.content[0].text.trim()

  const output = {
    description,
    generatedAt: new Date().toISOString(),
    trackCount: data.tracks.length
  }

  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2))
  console.log(`[music-desc] ✓ Description generated → ${OUT_FILE}`)
  console.log(`[music-desc]   "${description}"`)
}

main().catch(err => {
  console.error('[music-desc] Error:', err.message)
  process.exit(0)
})
