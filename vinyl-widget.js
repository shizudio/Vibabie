// Guard: don't re-initialize if widget already exists (soft navigation)
if (document.getElementById('vinyl-widget')) {
  // Widget already alive — do nothing
} else {
/**
 * vinyl-widget.js
 * Universal mini vinyl player widget.
 * Loaded on all pages except record.html.
 * Injects DOM, loads Spotify IFrame API, handles play/pause.
 * Dropdown menu with 3 track picks + link to The Record page.
 */

const PLAY_SVG  = '<svg viewBox="0 0 24 24" fill="white"><polygon points="6,3 20,12 6,21" /></svg>'
const PAUSE_SVG = '<svg viewBox="0 0 24 24" fill="white"><rect x="5" y="3" width="4" height="18" /><rect x="15" y="3" width="4" height="18" /></svg>'
const NOTE_ICON = '♪'

// ── Fetch track data ────────────────────────────────────────────────────────
const data = await fetch('/spotify-data.json')
  .then(r => r.json())
  .catch(() => null)

const tracks = data?.tracks ?? []
const defaultTrack = tracks.length > 0 ? tracks[Math.floor(Math.random() * tracks.length)] : null
const albumArt = defaultTrack?.albumArtSmall || ''

// Pick 3 random tracks for the menu (shuffled on each page load)
const menuTracks = []
if (tracks.length > 0) {
  const indices = Array.from({ length: tracks.length }, (_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]]
  }
  const picked = indices.slice(0, Math.min(3, tracks.length))
  picked.forEach(i => menuTracks.push({ ...tracks[i], _idx: i }))
}

// ── Build menu items HTML ───────────────────────────────────────────────────
const menuItemsHTML = menuTracks.map(t => `
  <button class="vinyl-widget-menu-item" data-track-index="${t._idx}">
    <img src="${t.albumArtSmall}" alt="" />
    <div class="vinyl-widget-menu-info">
      <span class="vinyl-widget-menu-name">${t.name}</span>
      <span class="vinyl-widget-menu-artist">${t.artist}</span>
    </div>
  </button>
`).join('')

// ── Inject widget HTML ──────────────────────────────────────────────────────
const widget = document.createElement('div')
widget.className = 'vinyl-widget'
widget.id = 'vinyl-widget'
widget.innerHTML = `
  <div class="vinyl-widget-menu">
    ${menuItemsHTML}
    <div class="vinyl-widget-menu-divider"></div>
    <a href="/record.html" class="vinyl-widget-menu-link">The Record ↗</a>
  </div>
  <div class="vinyl-container">
    <div class="vinyl-disc" id="widget-disc">
      <div class="vinyl-label">
        <img class="vinyl-label-img" id="widget-label-img" src="${albumArt}" alt="" />
      </div>
      <div class="vinyl-play-icon" id="widget-play-icon">${PLAY_SVG}</div>
    </div>
  </div>
  <button class="vinyl-widget-toggle" id="widget-toggle" aria-label="Track menu">${NOTE_ICON}</button>
`
document.body.appendChild(widget)

// ── DOM refs ────────────────────────────────────────────────────────────────
const disc      = document.getElementById('widget-disc')
const playIcon  = document.getElementById('widget-play-icon')
const labelImg  = document.getElementById('widget-label-img')
const toggle    = document.getElementById('widget-toggle')
const container = widget.querySelector('.vinyl-container')

// ── Spotify playback control ────────────────────────────────────────────────
let spotifyController = null

function setPlayState(playing) {
  container.classList.toggle('playing', playing)
  playIcon.innerHTML = playing ? PAUSE_SVG : PLAY_SVG
}

disc.addEventListener('click', () => {
  if (spotifyController) spotifyController.togglePlay()
})

// ── Dropdown menu ───────────────────────────────────────────────────────────
toggle.addEventListener('click', (e) => {
  e.stopPropagation()
  widget.classList.toggle('menu-open')
})

// Auto-collapse with delay so cursor can move between toggle and menu
let closeTimer = null

widget.addEventListener('mouseleave', () => {
  closeTimer = setTimeout(() => {
    widget.classList.remove('menu-open')
  }, 400)
})

widget.addEventListener('mouseenter', () => {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
})

// Close on outside click
document.addEventListener('click', (e) => {
  if (!widget.contains(e.target)) {
    widget.classList.remove('menu-open')
  }
})

// Track item clicks → play that track
widget.querySelectorAll('.vinyl-widget-menu-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const idx = parseInt(btn.dataset.trackIndex)
    const track = tracks[idx]
    if (spotifyController && track && track.spotifyId) {
      spotifyController.loadUri(`spotify:track:${track.spotifyId}`)
      setTimeout(() => spotifyController.play(), 300)
      if (labelImg) labelImg.src = track.albumArt || track.albumArtSmall
    }
    widget.classList.remove('menu-open')
  })
})

// ── Load Spotify IFrame API ─────────────────────────────────────────────────
function initWidget(IFrameAPI) {
  // Create embed container dynamically (Spotify API consumes static ones)
  const el = document.createElement('div')
  el.className = 'vinyl-widget-embed'
  widget.appendChild(el)
  const defaultUri = defaultTrack?.spotifyId
    ? `spotify:track:${defaultTrack.spotifyId}`
    : 'spotify:playlist:7nJm9hIEEOYdvgNgNxmMVt'
  IFrameAPI.createController(el, {
    uri: defaultUri,
    width: 1,
    height: 1,
    theme: 0
  }, (controller) => {
    spotifyController = controller
    controller.addListener('playback_update', (e) => {
      setPlayState(!e.data.isPaused)
      if (e.data.track?.name && labelImg) {
        const playing = tracks.find(t => t.name === e.data.track.name)
        if (playing) labelImg.src = playing.albumArt || playing.albumArtSmall
      }
      // Persist current track to sessionStorage so it resumes on navigation
      if (e.data.track?.name) {
        sessionStorage.setItem('vinyl-playing', JSON.stringify({
          name: e.data.track.name,
          paused: e.data.isPaused
        }))
      }
    })

    // Auto-play on first visit in session
    if (!sessionStorage.getItem('vinyl-visited')) {
      sessionStorage.setItem('vinyl-visited', '1')
      setTimeout(() => controller.play(), 300)
    }
    // Resume playback if user was playing before navigation
    else {
      try {
        const prev = JSON.parse(sessionStorage.getItem('vinyl-playing'))
        if (prev && !prev.paused) {
          setTimeout(() => controller.play(), 300)
        }
      } catch {}
    }
  })
}

// Set up Spotify IFrame API — must handle 3 cases:
// 1. Record page already set up __spotifyReady (use it)
// 2. API already fired before this module loaded (SpotifyIframeApi exists)
// 3. API hasn't loaded yet (set callback, load script)
if (window.__spotifyReady) {
  window.__spotifyReady.then(initWidget)
} else if (window.SpotifyIframeApi) {
  initWidget(window.SpotifyIframeApi)
} else {
  // Inject inline script BEFORE the API script to capture the callback
  const inlineScript = document.createElement('script')
  inlineScript.textContent = `
    window.__spotifyReady = new Promise(function(resolve) {
      window.onSpotifyIframeApiReady = resolve
    })
  `
  document.head.appendChild(inlineScript)
  window.__spotifyReady.then(initWidget)

  if (!document.querySelector('script[src*="spotify.com/embed/iframe-api"]')) {
    const s = document.createElement('script')
    s.src = 'https://open.spotify.com/embed/iframe-api/v1'
    s.async = true
    document.head.appendChild(s)
  }
}
} // end guard
