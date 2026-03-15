#!/usr/bin/env node
/**
 * fetch-cosmos.js
 * Fetches your Cosmos collection via their GraphQL API and writes cosmos-data.json.
 * Runs automatically before every build via the "prebuild" npm script.
 *
 * ── Auto-update on Vercel (free) ─────────────────────────────────────────────
 *   1. Vercel → Project → Settings → Git → Deploy Hooks → create a hook → copy URL
 *   2. Add that URL as a daily cron at https://cron-job.org (free tier)
 *   Each triggered build re-runs this script → fresh images deployed automatically.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * If the API is unreachable or returns no data, the script exits cleanly and the
 * existing cosmos-data.json is preserved as a fallback.
 */

import { writeFileSync, readFileSync, existsSync } from 'fs'

const COSMOS_URL  = 'https://www.cosmos.so/shizudio/personal-aesthetics'
const GRAPHQL_URL = 'https://api.cosmos.so/graphql'
const OUT_FILE    = './public/cosmos-data.json'

const QUERY = `
  query GetCluster {
    cluster(input: { ownerUsername: "shizudio", slug: "personal-aesthetics" }) {
      id
      name
      elements {
        items {
          __typename
          id
          ... on Element {
            image { url width height }
          }
          ... on InstagramElement {
            image { url width height }
          }
          ... on PinterestElement {
            image { url width height }
          }
        }
      }
    }
  }
`

function loadExisting() {
  if (existsSync(OUT_FILE)) {
    try { return JSON.parse(readFileSync(OUT_FILE, 'utf8')) } catch {}
  }
  return null
}

function keepExisting(reason) {
  console.warn(`[fetch-cosmos] ${reason} — keeping existing cosmos-data.json`)
  process.exit(0)
}

async function main() {
  console.log('[fetch-cosmos] Fetching Cosmos collection…')

  let res
  try {
    res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://www.cosmos.so',
        'Origin':  'https://www.cosmos.so'
      },
      body: JSON.stringify({ query: QUERY })
    })
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

  if (json.errors?.length) {
    keepExisting(`GraphQL error: ${json.errors[0].message}`)
  }

  const cluster = json?.data?.cluster
  if (!cluster) keepExisting('No cluster in response')

  const items = cluster?.elements?.items ?? []
  if (items.length === 0) keepExisting('0 elements returned')

  const elements = items
    .filter(el => el?.image?.url?.startsWith('https://cdn.cosmos.so/'))
    .map(el => ({
      url:         el.image.url,
      width:       el.image.width  ?? null,
      height:      el.image.height ?? null,
      aspectRatio: el.image.width && el.image.height
        ? +(el.image.width / el.image.height).toFixed(7)
        : 1
    }))

  if (elements.length === 0) keepExisting('No valid cdn.cosmos.so images found')

  const existing = loadExisting()
  const output = {
    title:       cluster.name ?? 'Personal aesthetics',
    username:    'shizudio',
    cosmosUrl:   COSMOS_URL,
    lastUpdated: new Date().toISOString(),
    elements
  }

  // If element count and first URL are identical, just update lastUpdated
  if (
    existing &&
    existing.elements?.length === elements.length &&
    existing.elements?.[0]?.url === elements[0]?.url
  ) {
    existing.lastUpdated = output.lastUpdated
    writeFileSync(OUT_FILE, JSON.stringify(existing, null, 2))
    console.log(`[fetch-cosmos] ✓ Collection unchanged (${elements.length} elements), updated timestamp`)
  } else {
    writeFileSync(OUT_FILE, JSON.stringify(output, null, 2))
    console.log(`[fetch-cosmos] ✓ Saved ${elements.length} elements → ${OUT_FILE}`)
  }
}

main().catch(err => {
  console.error('[fetch-cosmos] Unexpected error:', err.message)
  process.exit(0) // non-fatal
})
