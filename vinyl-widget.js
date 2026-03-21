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

// ── Session cache: keep same playlist + playback state across pages ────────
// Clear cache on manual refresh of index page so playlist re-randomizes
const SESSION_KEY = 'vinyl-widget-session'
const isIndexPage = location.pathname === '/' || location.pathname === '/index.html'
const navEntries = performance.getEntriesByType('navigation')
const isReload = navEntries.length > 0 ? navEntries[0].type === 'reload' : performance.navigation?.type === 1
if (isIndexPage && isReload) {
  sessionStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem('vinyl-playing')
}

let session = null
try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY)) } catch {}

// Pick 3 random tracks (or restore from session)
const menuTracks = []
let defaultTrackIdx = 0

if (tracks.length > 0) {
  if (session?.menuIndices?.length && session.menuIndices.every(i => i < tracks.length)) {
    // Restore cached selection
    session.menuIndices.forEach(i => menuTracks.push({ ...tracks[i], _idx: i }))
    defaultTrackIdx = session.defaultIdx ?? session.menuIndices[0]
  } else {
    // Fresh random selection
    const indices = Array.from({ length: tracks.length }, (_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]]
    }
    const picked = indices.slice(0, Math.min(3, tracks.length))
    picked.forEach(i => menuTracks.push({ ...tracks[i], _idx: i }))
    defaultTrackIdx = picked[0]
  }
}

const defaultTrack = tracks[defaultTrackIdx] || null
const albumArt = defaultTrack?.albumArtSmall || ''

// Save initial session if fresh
if (!session) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      menuIndices: menuTracks.map(t => t._idx),
      defaultIdx: defaultTrackIdx
    }))
  } catch {}
}

function saveSession(updates = {}) {
  const current = {
    menuIndices: menuTracks.map(t => t._idx),
    defaultIdx: defaultTrackIdx,
    ...updates
  }
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(current)) } catch {}
}

// ── Build sleeve items HTML (vinyl sleeves — square album slips) ─────────────
const sleeveAngles = [-8, -3, 4, 10] // organic tilt per sleeve
const sleeveItemsHTML = menuTracks.map((t, i) => `
  <button class="vinyl-sleeve" data-track-index="${t._idx}" style="--sleeve-i: ${i}; --sleeve-angle: ${sleeveAngles[i] || 0}deg">
    <img class="vinyl-sleeve-art" src="${t.albumArt || t.albumArtSmall}" alt="" />
    <div class="vinyl-sleeve-info">
      <span class="vinyl-sleeve-name">${t.name}</span>
      <span class="vinyl-sleeve-artist">${t.artist}</span>
    </div>
  </button>
`).join('')

// ── Inject widget HTML ──────────────────────────────────────────────────────
const widget = document.createElement('div')
widget.className = 'vinyl-widget'
widget.id = 'vinyl-widget'
widget.innerHTML = `
  <div class="vinyl-widget-backdrop" id="widget-backdrop"></div>
  <div class="vinyl-widget-sleeves" id="widget-sleeves">
    ${sleeveItemsHTML}
    <a href="/record.html" class="vinyl-sleeve vinyl-sleeve-link" style="--sleeve-i: ${menuTracks.length}; --sleeve-angle: ${sleeveAngles[menuTracks.length] || 10}deg">
      <span class="vinyl-sleeve-link-label">The Record ↗</span>
    </a>
  </div>
  <div class="vinyl-widget-player">
    <button class="vinyl-widget-chevron" id="widget-chevron" aria-label="Browse tracks">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <polygon points="16,4 8,12 16,20" />
      </svg>
    </button>
    <div class="vinyl-container">
      <div class="vinyl-disc" id="widget-disc">
        <div class="vinyl-label">
          <img class="vinyl-label-img" id="widget-label-img" src="${albumArt}" alt="" />
        </div>
        <div class="vinyl-play-icon" id="widget-play-icon">${PLAY_SVG}</div>
      </div>
      <div class="vinyl-widget-tonearm" id="widget-tonearm">
        <img class="tonearm-img" src="/vinyl/tonearm.svg" alt="Tonearm" />
      </div>
    </div>
  </div>
`
document.body.appendChild(widget)

// ── DOM refs ────────────────────────────────────────────────────────────────
const disc       = document.getElementById('widget-disc')
const playIcon   = document.getElementById('widget-play-icon')
const labelImg   = document.getElementById('widget-label-img')
const tonearm    = document.getElementById('widget-tonearm')
const chevron    = document.getElementById('widget-chevron')
const trackName  = document.getElementById('widget-track-name')
const trackArtist = document.getElementById('widget-track-artist')
const container  = widget.querySelector('.vinyl-container')

// ── Spotify playback control ────────────────────────────────────────────────
let spotifyController = null
let pendingPlay = false  // true if user interacted before controller was ready
let isPlaying = false
let currentTrackName = defaultTrack?.name || ''

function setPlayState(playing) {
  isPlaying = playing
  container.classList.toggle('playing', playing)
  widget.classList.toggle('playing-active', playing)
  playIcon.innerHTML = playing ? PAUSE_SVG : PLAY_SVG
  // Save state for cross-page resume (Spotify preview mode doesn't fire events)
  sessionStorage.setItem('vinyl-playing', JSON.stringify({
    name: currentTrackName,
    paused: !playing
  }))
}

// ── Early interaction listener for autoplay ─────────────────────────────────
// Set up BEFORE the Spotify controller is ready so we never miss user gestures.
// When the user interacts, either play immediately (if controller ready) or
// queue the play for when the controller becomes available.
if (!sessionStorage.getItem('vinyl-visited')) {
  const onFirstInteraction = () => {
    if (spotifyController) {
      spotifyController.play()
      setPlayState(true)
    } else {
      pendingPlay = true
    }
    document.removeEventListener('click', onFirstInteraction)
    document.removeEventListener('keydown', onFirstInteraction)
    document.removeEventListener('scroll', onFirstInteraction)
    document.removeEventListener('touchstart', onFirstInteraction)
  }
  document.addEventListener('click', onFirstInteraction)
  document.addEventListener('keydown', onFirstInteraction)
  document.addEventListener('scroll', onFirstInteraction)
  document.addEventListener('touchstart', onFirstInteraction)
}

function toggleWidgetPlay() {
  if (!spotifyController) return
  spotifyController.togglePlay()
  setPlayState(!isPlaying)
}

disc.addEventListener('click', toggleWidgetPlay)

// ── Tonearm click = play/pause ──────────────────────────────────────────────
tonearm.addEventListener('click', toggleWidgetPlay)

// ── Emoji cursor on tonearm hover ──────────────────────────────────────────
tonearm.addEventListener('mouseenter', () => {
  if (window.cursorMorphTo) window.cursorMorphTo('💿')
})
tonearm.addEventListener('mouseleave', () => {
  if (window.cursorMorphBack) window.cursorMorphBack()
})

// ── Chevron = open/close sleeve stack ──────────────────────────────────────
chevron.addEventListener('click', (e) => {
  e.stopPropagation()
  widget.classList.toggle('menu-open')
})

// Backdrop closes bottom sheet on mobile
document.getElementById('widget-backdrop')?.addEventListener('click', () => {
  widget.classList.remove('menu-open')
})

// No auto-collapse — sleeves are at the bottom of screen, close via backdrop or outside click

// Adaptive chevron color — samples background behind the arrow
function updateChevronColor() {
  const chevron = document.getElementById('widget-chevron')
  if (!chevron) return
  const rect = chevron.getBoundingClientRect()
  const x = Math.round(rect.left + rect.width / 2)
  const y = Math.round(rect.top + rect.height / 2)

  // Temporarily hide entire widget to sample page content behind
  widget.style.visibility = 'hidden'
  const el = document.elementFromPoint(x, y)
  widget.style.visibility = ''

  if (!el) return

  // If element is an image, sample its pixel color via canvas
  if (el.tagName === 'IMG' && el.complete && el.naturalWidth > 0) {
    try {
      const imgRect = el.getBoundingClientRect()
      const imgX = ((x - imgRect.left) / imgRect.width) * el.naturalWidth
      const imgY = ((y - imgRect.top) / imgRect.height) * el.naturalHeight
      const canvas = document.createElement('canvas')
      canvas.width = 1; canvas.height = 1
      const ctx = canvas.getContext('2d')
      ctx.drawImage(el, imgX, imgY, 1, 1, 0, 0, 1, 1)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      chevron.style.color = brightness > 140 ? 'var(--crimson)' : '#f5f0eb'
      return
    } catch (e) {
      // CORS or other error — fall through to CSS approach
    }
  }

  // Walk up DOM to find first non-transparent CSS background
  let target = el
  let r = 245, g = 240, b = 235 // fallback: beige
  while (target && target !== document.documentElement) {
    const bg = getComputedStyle(target).backgroundColor
    const match = bg.match(/\d+/g)
    if (match && match.length >= 3) {
      const [cr, cg, cb, ca] = match.map(Number)
      if (ca !== 0 && !(cr === 0 && cg === 0 && cb === 0 && match.length === 4 && ca === 0)) {
        r = cr; g = cg; b = cb
        break
      }
    }
    target = target.parentElement
  }
  // Perceived brightness (W3C formula)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  chevron.style.color = brightness > 140 ? 'var(--crimson)' : '#f5f0eb'
}

// Run on scroll and resize
updateChevronColor()
window.addEventListener('scroll', updateChevronColor, { passive: true })
window.addEventListener('resize', updateChevronColor, { passive: true })

// Close on outside click
document.addEventListener('click', (e) => {
  if (!widget.contains(e.target)) {
    widget.classList.remove('menu-open')
  }
})

// Sleeve item clicks → first click lifts sleeve, second click plays
const allSleeves = widget.querySelectorAll('.vinyl-sleeve[data-track-index]')
allSleeves.forEach(btn => {
  btn.addEventListener('click', (e) => {
    // First click: lift/expand the sleeve
    if (!btn.classList.contains('sleeve-active')) {
      e.preventDefault()
      allSleeves.forEach(s => s.classList.remove('sleeve-active'))
      btn.classList.add('sleeve-active')
      return
    }

    // Second click: play the track, retract sleeves
    const idx = parseInt(btn.dataset.trackIndex)
    const track = tracks[idx]
    if (spotifyController && track && track.spotifyId) {
      spotifyController.loadUri(`spotify:track:${track.spotifyId}`)
      setTimeout(() => spotifyController.play(), 300)
      if (labelImg) labelImg.src = track.albumArt || track.albumArtSmall
      if (trackName) trackName.textContent = track.name
      if (trackArtist) trackArtist.textContent = track.artist
      currentTrackName = track.name
      defaultTrackIdx = idx
      setPlayState(true)
      saveSession({ defaultIdx: idx, playing: true })
    }
    allSleeves.forEach(s => s.classList.remove('sleeve-active'))
    widget.classList.remove('menu-open')
  })
})

// Close menu + retract sleeves when clicking outside
document.addEventListener('click', (e) => {
  if (!widget.contains(e.target) && widget.classList.contains('menu-open')) {
    widget.classList.remove('menu-open')
    allSleeves.forEach(s => s.classList.remove('sleeve-active'))
  }
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
      if (e.data.track?.name) {
        trackName.textContent = e.data.track.name
        trackArtist.textContent = e.data.track.artists?.[0]?.name || ''
      }
      // Persist current track to sessionStorage so it resumes on navigation
      if (e.data.track?.name) {
        const playingIdx = tracks.findIndex(t => t.name === e.data.track.name)
        sessionStorage.setItem('vinyl-playing', JSON.stringify({
          name: e.data.track.name,
          paused: e.data.isPaused
        }))
        if (playingIdx >= 0) saveSession({ defaultIdx: playingIdx, playing: !e.data.isPaused })
      }
    })

    // Auto-play on first visit in session
    // The interaction listener was set up early (before controller ready).
    // If user already interacted, pendingPlay is true — play now.
    // If not, the early listener will call controller.play() when they do.
    if (!sessionStorage.getItem('vinyl-visited')) {
      sessionStorage.setItem('vinyl-visited', '1')
      if (pendingPlay) {
        controller.play()
        setPlayState(true)
        pendingPlay = false
      }
    }
    // Resume playback if user was playing before navigation
    else {
      try {
        const prev = JSON.parse(sessionStorage.getItem('vinyl-playing'))
        if (prev && !prev.paused) {
          // Load the last-played track, then auto-play
          const lastTrack = tracks.find(t => t.name === prev.name)
          if (lastTrack?.spotifyId) {
            controller.loadUri(`spotify:track:${lastTrack.spotifyId}`)
            currentTrackName = lastTrack.name
          }
          setTimeout(() => {
            controller.play()
            setPlayState(true)
          }, 500)
        }
      } catch {}
    }
  })
}

// Set up Spotify IFrame API
// The key challenge: the API script fires onSpotifyIframeApiReady synchronously
// when it loads, but ES modules are deferred. So we must set up the callback
// via a synchronous inline script BEFORE loading the API script.

if (window.SpotifyIframeApi) {
  // API already loaded and ready (unlikely but handle it)
  initWidget(window.SpotifyIframeApi)
} else {
  // Inject synchronous inline script to capture the callback BEFORE the API loads
  if (!window.__spotifyWidgetReady) {
    const setup = document.createElement('script')
    setup.textContent = `
      window.__spotifyWidgetReady = new Promise(function(resolve) {
        var orig = window.onSpotifyIframeApiReady;
        window.onSpotifyIframeApiReady = function(api) {
          window.SpotifyIframeApi = api;
          resolve(api);
          if (orig) orig(api);
        };
      });
    `
    document.head.appendChild(setup)
  }

  // Now load the API script (it will find our callback ready)
  if (!document.querySelector('script[src*="spotify.com/embed/iframe-api"]')) {
    const s = document.createElement('script')
    s.src = 'https://open.spotify.com/embed/iframe-api/v1'
    document.head.appendChild(s)
  }

  window.__spotifyWidgetReady.then(initWidget)
}
} // end guard
