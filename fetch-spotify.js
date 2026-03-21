#!/usr/bin/env node
/**
 * fetch-spotify.js
 * Fetches playlist track data from the Spotify Web API and writes spotify-data.json.
 * Runs automatically before every build via the "prebuild" npm script.
 *
 * Uses the Client Credentials flow (no user auth needed for public playlists).
 * Requires SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables.
 *
 * If credentials are missing or the API is unreachable, the script exits cleanly
 * and the existing spotify-data.json is preserved as a fallback.
 */

import { writeFileSync, readFileSync, existsSync } from 'fs'

const PLAYLIST_ID = '7nJm9hIEEOYdvgNgNxmMVt'
const TOKEN_URL   = 'https://accounts.spotify.com/api/token'
const API_BASE    = 'https://api.spotify.com/v1'
const OUT_FILE    = './public/spotify-data.json'

function loadExisting() {
  if (existsSync(OUT_FILE)) {
    try { return JSON.parse(readFileSync(OUT_FILE, 'utf8')) } catch {}
  }
  return null
}

function keepExisting(reason) {
  console.warn(`[fetch-spotify] ${reason} — keeping existing spotify-data.json`)
  process.exit(0)
}

async function getAccessToken(clientId, clientSecret) {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  })

  if (!res.ok) throw new Error(`Token request failed: HTTP ${res.status}`)
  const data = await res.json()
  return data.access_token
}

async function main() {
  console.log('[fetch-spotify] Fetching Spotify playlist…')

  const clientId     = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    keepExisting('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET')
  }

  let token
  try {
    token = await getAccessToken(clientId, clientSecret)
  } catch (err) {
    keepExisting(`Auth error: ${err.message}`)
  }

  let res
  try {
    const fields = 'items(track(name,uri,duration_ms,preview_url,artists(name),album(name,images)))'
    res = await fetch(
      `${API_BASE}/playlists/${PLAYLIST_ID}/tracks?limit=100&fields=${fields}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
  } catch (err) {
    keepExisting(`Network error: ${err.message}`)
  }

  if (!res.ok) keepExisting(`HTTP ${res.status}`)

  let json
  try {
    json = await res.json()
  } catch {
    keepExisting('Invalid JSON response')
  }

  const items = json?.items ?? []
  if (items.length === 0) keepExisting('0 tracks returned')

  const tracks = items
    .filter(item => item?.track)
    .map(item => {
      const t = item.track
      return {
        name:          t.name,
        uri:           t.uri,
        artist:        t.artists.map(a => a.name).join(', '),
        album:         t.album.name,
        albumArt:      t.album.images[1]?.url ?? t.album.images[0]?.url,
        albumArtSmall: t.album.images[2]?.url ?? t.album.images[0]?.url,
        durationMs:    t.duration_ms
      }
    })

  if (tracks.length === 0) keepExisting('No valid tracks found')

  const existing = loadExisting()
  const output = {
    playlistId:  PLAYLIST_ID,
    playlistUrl: `https://open.spotify.com/playlist/${PLAYLIST_ID}`,
    lastUpdated: new Date().toISOString(),
    tracks
  }

  // If track count, first track name, and fields are identical, just update timestamp
  const hasAllFields = existing?.tracks?.[0]?.uri !== undefined
  if (
    hasAllFields &&
    existing &&
    existing.tracks?.length === tracks.length &&
    existing.tracks?.[0]?.name === tracks[0]?.name
  ) {
    existing.lastUpdated = output.lastUpdated
    writeFileSync(OUT_FILE, JSON.stringify(existing, null, 2))
    console.log(`[fetch-spotify] ✓ Playlist unchanged (${tracks.length} tracks), updated timestamp`)
  } else {
    writeFileSync(OUT_FILE, JSON.stringify(output, null, 2))
    console.log(`[fetch-spotify] ✓ Saved ${tracks.length} tracks → ${OUT_FILE}`)
  }
}

main().catch(err => {
  console.error('[fetch-spotify] Unexpected error:', err.message)
  process.exit(0) // non-fatal
})
