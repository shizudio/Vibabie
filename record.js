const data = await fetch('/spotify-data.json')
  .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
  .catch(err => { console.warn('record.js: could not load spotify-data.json –', err); return { tracks: [], lastUpdated: null } })

const tracklist     = document.getElementById('tracklist')
const updatedEl     = document.getElementById('record-updated')
const vinylLabelImg = document.getElementById('vinyl-label-img')
const descEl        = document.getElementById('record-desc')
const embedContainer = document.getElementById('embed-container')

// ── Load AI-generated description ───────────────────────────────────────────
const descData = await fetch('/music-description.json')
  .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
  .catch(() => null)

if (descData?.description && descEl) {
  descEl.textContent = descData.description
}

// ── Vinyl play/pause state ──────────────────────────────────────────────────
const vinylContainer = document.querySelector('.vinyl-container')
const vinylDisc      = document.getElementById('vinyl-disc')
const tonearm        = document.querySelector('.vinyl-tonearm')
const playIcon       = document.getElementById('vinyl-play-icon')

const PLAY_SVG  = '<svg viewBox="0 0 24 24" fill="white"><polygon points="6,3 20,12 6,21" /></svg>'
const PAUSE_SVG = '<svg viewBox="0 0 24 24" fill="white"><rect x="5" y="3" width="4" height="18" /><rect x="15" y="3" width="4" height="18" /></svg>'

const PLAYLIST_ID = '7nJm9hIEEOYdvgNgNxmMVt'
let spotifyController = null
let isPlaying = false

// Check if user was playing a track in the widget — start from that track
let currentTrackIndex = 0
try {
  const prev = JSON.parse(sessionStorage.getItem('vinyl-playing'))
  if (prev?.name) {
    const idx = data.tracks.findIndex(t => t.name === prev.name)
    if (idx >= 0) currentTrackIndex = idx
  }
} catch {}

function setPlayState(playing) {
  isPlaying = playing
  if (vinylContainer) vinylContainer.classList.toggle('playing', playing)
  if (playIcon) playIcon.innerHTML = playing ? PAUSE_SVG : PLAY_SVG
}

function updateActiveTrack(idx) {
  if (idx < 0 || idx >= data.tracks.length) return
  currentTrackIndex = idx
  const track = data.tracks[idx]
  if (vinylLabelImg) vinylLabelImg.src = track.albumArt
  document.querySelectorAll('.track-row').forEach((row) => {
    row.classList.toggle('active', parseInt(row.dataset.index) === idx)
  })
}

// ── Track selection via IFrame API loadUri ───────────────────────────────────
function playTrackByIndex(idx) {
  if (data.tracks.length === 0) return
  const track = data.tracks[idx]
  if (!track) return
  currentTrackIndex = idx

  if (spotifyController && track.spotifyId) {
    // loadUri with individual track URI — this switches the track
    spotifyController.loadUri(`spotify:track:${track.spotifyId}`)
    // play() after a short delay to let the embed load
    setTimeout(() => {
      spotifyController.play()
    }, 300)
  }

  updateActiveTrack(idx)
  setPlayState(true)
}

function togglePlay() {
  if (spotifyController) {
    spotifyController.togglePlay()
  }
}

// Click disc or tonearm to toggle play/pause
if (vinylDisc) vinylDisc.addEventListener('click', togglePlay)
if (tonearm) tonearm.addEventListener('click', togglePlay)

// Emoji cursor on tonearm hover
if (tonearm) {
  tonearm.addEventListener('mouseenter', () => {
    if (window.cursorMorphTo) window.cursorMorphTo('💿')
  })
  tonearm.addEventListener('mouseleave', () => {
    if (window.cursorMorphBack) window.cursorMorphBack()
  })
}

// Prev/Next buttons
document.getElementById('record-prev')?.addEventListener('click', () => {
  if (data.tracks.length === 0) return
  const idx = (currentTrackIndex - 1 + data.tracks.length) % data.tracks.length
  playTrackByIndex(idx)
})

document.getElementById('record-next')?.addEventListener('click', () => {
  if (data.tracks.length === 0) return
  const idx = (currentTrackIndex + 1) % data.tracks.length
  playTrackByIndex(idx)
})

// ── Spotify IFrame API init ─────────────────────────────────────────────────
window.__spotifyReady.then((IFrameAPI) => {
  const el = document.createElement('div')
  embedContainer.appendChild(el)

  // Load the last-played track if coming from widget, otherwise full playlist
  const initialTrack = data.tracks[currentTrackIndex]
  const initialUri = initialTrack?.spotifyId
    ? `spotify:track:${initialTrack.spotifyId}`
    : `spotify:playlist:${PLAYLIST_ID}`

  IFrameAPI.createController(el, {
    uri: initialUri,
    width: '100%',
    height: 152,
    theme: 0
  }, (controller) => {
    spotifyController = controller
    controller.addListener('playback_update', (e) => {
      setPlayState(!e.data.isPaused)
      if (e.data.track?.name) {
        const idx = data.tracks.findIndex(t => t.name === e.data.track.name)
        if (idx !== -1) updateActiveTrack(idx)
      }
    })

    // Auto-play: if user was playing in widget, continue on record page
    try {
      const prev = JSON.parse(sessionStorage.getItem('vinyl-playing'))
      if (prev && !prev.paused) {
        setTimeout(() => {
          controller.play()
          setPlayState(true)
        }, 500)
      }
    } catch {}
  })
})

// ── Format duration from ms → m:ss ──────────────────────────────────────────
function formatDuration(ms) {
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// ── Set initial vinyl label image + active track ────────────────────────────
if (data.tracks.length > 0 && vinylLabelImg) {
  vinylLabelImg.src = data.tracks[currentTrackIndex].albumArt
  updateActiveTrack(currentTrackIndex)
}

// ── Last updated ────────────────────────────────────────────────────────────
if (updatedEl && data.lastUpdated) {
  const d = new Date(data.lastUpdated)
  updatedEl.textContent = `Updated ${d.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  })}`
}

// ── Render track list ───────────────────────────────────────────────────────
const PREVIEW_COUNT = 10

function renderRow(track, i) {
  const row = document.createElement('div')
  row.className = 'track-row'
  row.style.cursor = 'pointer'
  row.dataset.index = i

  row.innerHTML = `
    <span class="track-num">${i + 1}</span>
    <img class="track-art" src="${track.albumArtSmall}" alt="" loading="lazy" />
    <div class="track-info">
      <span class="track-name">${track.name}</span>
      <span class="track-artist">${track.artist}</span>
    </div>
    <span class="track-duration">${formatDuration(track.durationMs)}</span>
  `

  row.addEventListener('click', () => playTrackByIndex(i))
  return row
}

data.tracks.slice(0, PREVIEW_COUNT).forEach((track, i) => {
  tracklist.appendChild(renderRow(track, i))
})

// "See all" button
const remaining = data.tracks.slice(PREVIEW_COUNT)
if (remaining.length > 0) {
  const seeAllBar = document.createElement('div')
  seeAllBar.className = 'tracklist-see-all'

  const seeAllBtn = document.createElement('button')
  seeAllBtn.className = 'tracklist-see-all-btn'
  seeAllBtn.textContent = `See all ${data.tracks.length} tracks`
  seeAllBar.appendChild(seeAllBtn)
  tracklist.after(seeAllBar)

  let expanded = false

  seeAllBtn.addEventListener('click', () => {
    if (!expanded) {
      remaining.forEach((track, i) => {
        tracklist.appendChild(renderRow(track, PREVIEW_COUNT + i))
      })
      seeAllBtn.textContent = 'Show less'
      expanded = true
    } else {
      while (tracklist.children.length > PREVIEW_COUNT) {
        tracklist.lastChild.remove()
      }
      seeAllBtn.textContent = `See all ${data.tracks.length} tracks`
      tracklist.scrollIntoView({ behavior: 'smooth', block: 'start' })
      expanded = false
    }
  })
}

// ── Fade-in observer ────────────────────────────────────────────────────────
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible')
      observer.unobserve(entry.target)
    }
  })
}, { threshold: 0.05 })

document.querySelectorAll('.fade-up').forEach(el => observer.observe(el))
