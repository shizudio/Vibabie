/**
 * about-work.js — "Selected work" strip on the About page.
 *
 * Renders the first few manifest entries as 16:9 tiles between the hero and
 * the room. Driven entirely by public/work-manifest-v2.json, which is ordered
 * by standing — so "featured" is simply the top of the list, minus anything
 * unfinished. Nothing about the projects is hardcoded here.
 *
 * Soft-nav safe: about.html is in router.js's SOFT_NAV_PAGES, so <main> gets
 * replaced and this module is re-executed (cache-busted) on every arrival. It
 * therefore looks the container up fresh on each run and marks that container
 * before awaiting, so a re-run against an already-populated grid is a no-op.
 */

const MAX_TILES = 3

// The hero's fade-up stagger uses --i 0–4. The section head is one row of two
// peers — "Selected work" at 5, the "All work" link at 6 — so the tiles close
// the same wave at 7–9.
const STAGGER_START = 7

function buildBadge() {
  const badge = document.createElement('span')
  badge.className = 'about-work-badge'

  const dot = document.createElement('span')
  dot.className = 'about-work-badge-dot'
  badge.appendChild(dot)
  badge.appendChild(document.createTextNode('Currently building'))

  return badge
}

function buildTile(project, i) {
  const tile = document.createElement('a')
  tile.className = 'about-work-tile fade-up'
  tile.style.setProperty('--i', STAGGER_START + i)
  tile.dataset.aboutWorkInjected = 'true'
  tile.href = project.href && project.href !== '#' ? project.href : 'work.html'

  if (project.external) {
    tile.target = '_blank'
    tile.rel = 'noopener noreferrer'
  }

  const thumb = document.createElement('div')
  thumb.className = 'about-work-thumb'

  const img = document.createElement('img')
  img.src = project.src
  img.alt = project.title || ''
  img.loading = 'lazy'
  img.decoding = 'async'
  thumb.appendChild(img)

  if (project.current) thumb.appendChild(buildBadge())
  tile.appendChild(thumb)

  const title = document.createElement('span')
  title.className = 'about-work-title'
  title.textContent = project.title || ''
  tile.appendChild(title)

  if (project.tag) {
    const tag = document.createElement('span')
    tag.className = 'about-work-tag'
    tag.textContent = project.tag
    tile.appendChild(tag)
  }

  return tile
}

async function render() {
  const grid = document.getElementById('aboutWorkGrid')
  if (!grid) return

  // Claim this container synchronously, before any await — a second execution
  // of the module (double script tag, or a fast back/forward) then bails out
  // instead of racing to append a duplicate set of tiles.
  if (grid.dataset.aboutWorkState) return
  grid.dataset.aboutWorkState = 'loading'

  let projects
  try {
    // Same path work.js uses — resolves to /work-manifest-v2.json from any page.
    const resp = await fetch('work-manifest-v2.json')
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    projects = await resp.json()
  } catch (err) {
    // Fail quietly: an empty section beats a broken page.
    console.warn('about-work: manifest unavailable', err)
    grid.dataset.aboutWorkState = 'failed'
    return
  }

  if (!Array.isArray(projects)) {
    grid.dataset.aboutWorkState = 'failed'
    return
  }

  // Nothing unfinished, and nothing without a thumbnail, in a showcase.
  const featured = projects
    .filter(p => p && p.src && !p.comingSoon)
    .slice(0, MAX_TILES)

  if (!featured.length) {
    grid.dataset.aboutWorkState = 'empty'
    return
  }

  // A soft navigation may have swapped <main> out from under us mid-fetch.
  if (!grid.isConnected) return

  const frag = document.createDocumentFragment()
  featured.forEach((project, i) => frag.appendChild(buildTile(project, i)))
  grid.appendChild(frag)
  grid.dataset.aboutWorkState = 'ready'
}

render()
