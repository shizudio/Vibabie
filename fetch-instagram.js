#!/usr/bin/env node
/**
 * fetch-instagram.js
 * Fetches your Instagram posts via Basic Display API, downloads images locally
 * to instagram/, and writes instagram-data.json.
 *
 * Runs automatically before every build via the "prebuild" npm script.
 *
 * ── One-time setup ────────────────────────────────────────────────────────────
 *  1. Go to https://developers.facebook.com → My Apps → Create App
 *     Choose: Consumer → fill in app name
 *  2. Add product: "Instagram Basic Display"
 *  3. Under Instagram Basic Display → Basic Display:
 *     - Add OAuth Redirect URI: https://localhost/
 *     - Add Deauthorize / Data deletion callback URLs (can be same)
 *  4. Add your Instagram test user (Instagram Settings → Apps and Websites)
 *  5. Generate a User Token:
 *     https://developers.facebook.com/docs/instagram-basic-display-api/getting-started
 *     (follow steps 4-7 to get a short-lived token, then exchange below)
 *  6. Exchange for a long-lived token (60 days, auto-refreshed by this script):
 *     curl "https://graph.instagram.com/access_token?grant_type=ig_exchange_token
 *       &client_secret=APP_SECRET&access_token=SHORT_LIVED_TOKEN"
 *  7. Save the long-lived token:
 *     - Local dev: create .env → INSTAGRAM_TOKEN=your_token
 *     - Vercel: Project → Settings → Environment Variables → INSTAGRAM_TOKEN
 *
 * ── Auto-update on Vercel (free) ──────────────────────────────────────────────
 *  Vercel → Project → Settings → Git → Deploy Hooks → create hook → copy URL
 *  Add it as a daily cron at https://cron-job.org (free tier)
 *  Each build re-runs this script → fresh posts deployed automatically.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { writeFileSync, readFileSync, existsSync, mkdirSync } = require('fs')
const https  = require('https')
const http   = require('http')
const path   = require('path')
const url    = require('url')

const OUT_FILE    = './instagram-data.json'
const MEDIA_DIR   = './instagram'
const MAX_POSTS   = 24
const IG_USERNAME = 'shinana.ya'
const IG_URL      = 'https://www.instagram.com/shinana.ya'

// ── Load token from .env or process.env ───────────────────────────────────────
function loadToken() {
  if (process.env.INSTAGRAM_TOKEN) return process.env.INSTAGRAM_TOKEN
  const envFile = path.resolve(__dirname, '.env')
  if (existsSync(envFile)) {
    const lines = readFileSync(envFile, 'utf8').split('\n')
    for (const line of lines) {
      const m = line.match(/^\s*INSTAGRAM_TOKEN\s*=\s*(.+)\s*$/)
      if (m) return m[1].trim().replace(/^["']|["']$/g, '')
    }
  }
  return null
}

// ── Simple https GET helper → resolves with parsed JSON ───────────────────────
function fetchJSON(apiUrl) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(apiUrl)
    const lib = parsed.protocol === 'https:' ? https : http
    lib.get(apiUrl, { headers: { 'User-Agent': 'shizudio-site/1.0' } }, res => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(body)) } catch { reject(new Error('Invalid JSON')) }
      })
    }).on('error', reject)
  })
}

// ── Download binary file, follow redirects ────────────────────────────────────
function downloadFile(fileUrl, destPath) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(fileUrl)
    const lib = parsed.protocol === 'https:' ? https : http
    lib.get(fileUrl, { headers: { 'User-Agent': 'shizudio-site/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => { writeFileSync(destPath, Buffer.concat(chunks)); resolve() })
    }).on('error', reject)
  })
}

function loadExisting() {
  if (existsSync(OUT_FILE)) {
    try { return JSON.parse(readFileSync(OUT_FILE, 'utf8')) } catch {}
  }
  return null
}

function keepExisting(reason) {
  console.warn(`[fetch-instagram] ${reason} — keeping existing instagram-data.json`)
  process.exit(0)
}

// ── Auto-refresh long-lived token (resets 60-day expiry) ─────────────────────
async function refreshToken(token) {
  try {
    const data = await fetchJSON(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`
    )
    if (data.access_token) {
      console.log('[fetch-instagram] Token refreshed successfully')
      // Write back to .env if it exists locally
      const envFile = path.resolve(__dirname, '.env')
      if (existsSync(envFile)) {
        const current = readFileSync(envFile, 'utf8')
        const updated = current.replace(
          /INSTAGRAM_TOKEN=.*/,
          `INSTAGRAM_TOKEN=${data.access_token}`
        )
        writeFileSync(envFile, updated)
      }
      return data.access_token
    }
  } catch (e) {
    console.warn('[fetch-instagram] Token refresh failed (non-fatal):', e.message)
  }
  return token
}

async function main() {
  const token = loadToken()
  if (!token) {
    keepExisting(
      'No INSTAGRAM_TOKEN found. Set it in .env (local) or Vercel env vars.\n' +
      '  See fetch-instagram.js header for setup instructions.'
    )
  }

  console.log('[fetch-instagram] Fetching Instagram media…')

  // Refresh token to keep it alive
  const activeToken = await refreshToken(token)

  // Fetch media list
  let mediaData
  try {
    mediaData = await fetchJSON(
      `https://graph.instagram.com/me/media` +
      `?fields=id,caption,media_type,media_url,timestamp` +
      `&limit=${MAX_POSTS}` +
      `&access_token=${activeToken}`
    )
  } catch (e) {
    keepExisting(`API request failed: ${e.message}`)
  }

  if (mediaData.error) {
    keepExisting(`API error: ${mediaData.error.message}`)
  }

  const rawItems = mediaData?.data ?? []
  if (rawItems.length === 0) keepExisting('0 posts returned')

  // Filter to image posts only (skip videos/reels for now)
  const imageItems = rawItems.filter(
    item => item.media_type === 'IMAGE' || item.media_type === 'CAROUSEL_ALBUM'
  )
  if (imageItems.length === 0) keepExisting('No IMAGE posts returned')

  // Ensure download directory exists
  if (!existsSync(MEDIA_DIR)) mkdirSync(MEDIA_DIR, { recursive: true })

  const elements = []
  for (const item of imageItems) {
    const ext      = '.jpg'
    const filename = `${item.id}${ext}`
    const destPath = path.join(MEDIA_DIR, filename)

    // Download image if not already cached locally
    if (!existsSync(destPath)) {
      try {
        console.log(`[fetch-instagram]   ↓ ${filename}`)
        await downloadFile(item.media_url, destPath)
      } catch (e) {
        console.warn(`[fetch-instagram]   ✗ Failed to download ${filename}: ${e.message}`)
        continue
      }
    } else {
      console.log(`[fetch-instagram]   ✓ ${filename} (cached)`)
    }

    elements.push({
      id:        item.id,
      src:       `instagram/${filename}`,
      caption:   (item.caption ?? '').split('\n')[0].replace(/#\S+/g, '').trim(),
      timestamp: item.timestamp
    })
  }

  if (elements.length === 0) keepExisting('No images could be downloaded')

  const output = {
    username:    IG_USERNAME,
    instagramUrl: IG_URL,
    lastUpdated: new Date().toISOString(),
    elements
  }

  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2))
  console.log(`[fetch-instagram] ✓ Saved ${elements.length} posts → ${OUT_FILE}`)
}

main().catch(err => {
  console.error('[fetch-instagram] Unexpected error:', err.message)
  process.exit(0) // non-fatal — keep existing data
})
