/**
 * field-notes.js — the Field Notes index.
 *
 * Renders public/field-notes/index.json, which vite-plugin-field-notes.js
 * generates by globbing the entry files. Nothing here knows how many notes
 * exist or what they are called.
 *
 * CREDIT IS STRUCTURAL. Every card names its creator, and that name is a link
 * to them. This archive is about other people's work, so attribution is not a
 * courtesy line at the bottom of the entry page, it is on the card itself and
 * it is never optional: an entry with no creator renders the card without the
 * byline rather than quietly presenting the work as unattributed.
 *
 * MEDIA IS MINE. Thumbnails point at Shina's own captures under
 * /field-notes-media/. Nothing is ever hotlinked from the original project.
 */

const INDEX = '/field-notes/index.json'

const el = (tag, cls, text) => {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

function buildCard(entry, i) {
  const card = el('article', 'fn-card fade-up')
  card.style.setProperty('--i', String(Math.min(i, 8)))

  // The whole card is one link to the note. The creator credit below it is a
  // separate link to the creator, so the two destinations never fight: nested
  // anchors are invalid and would make the byline unclickable.
  const a = el('a', 'fn-card-link')
  a.href = `/field-notes/${entry.slug}`
  a.setAttribute('aria-label', `Read the field note on ${entry.title}`)

  const frame = el('div', 'fn-card-media')
  if (entry.thumbVideo) {
    const v = document.createElement('video')
    v.src = entry.thumbVideo
    v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true
    v.setAttribute('aria-hidden', 'true')
    frame.appendChild(v)
  } else if (entry.thumb) {
    const img = document.createElement('img')
    img.src = entry.thumb
    img.alt = entry.thumbAlt || ''
    img.loading = 'lazy'
    img.decoding = 'async'
    frame.appendChild(img)
  } else {
    // An entry whose capture has not been recorded yet. Says so plainly
    // rather than rendering a broken image or an empty box.
    frame.classList.add('is-empty')
    frame.appendChild(el('span', 'fn-card-placeholder', 'Recording to come'))
  }
  a.appendChild(frame)

  a.appendChild(el('h2', 'fn-card-title', entry.title))
  if (entry.hook) a.appendChild(el('p', 'fn-card-hook', entry.hook))
  card.appendChild(a)

  if (entry.creator) {
    const by = el('p', 'fn-card-by')
    by.appendChild(el('span', 'fn-by-label', 'By'))
    if (entry.creatorUrl) {
      const c = el('a', 'fn-by-name', entry.creator)
      c.href = entry.creatorUrl
      c.target = '_blank'
      c.rel = 'noopener'
      by.appendChild(c)
    } else {
      by.appendChild(el('span', 'fn-by-name', entry.creator))
    }
    card.appendChild(by)
  }

  if (entry.tags && entry.tags.length) {
    const tags = el('ul', 'fn-card-tags')
    entry.tags.forEach((t) => tags.appendChild(el('li', 'fn-tag', t)))
    card.appendChild(tags)
  }

  return card
}

async function init() {
  const grid = document.getElementById('fnGrid')
  if (!grid || grid.dataset.fnReady) return
  grid.dataset.fnReady = '1'

  let entries = []
  try {
    const res = await fetch(INDEX, { cache: 'no-cache' })
    if (res.ok) entries = (await res.json()).entries || []
  } catch (e) {
    // Offline or a missing index: say so instead of leaving a blank page.
  }

  grid.setAttribute('aria-busy', 'false')
  grid.textContent = ''

  if (!entries.length) {
    grid.appendChild(el('p', 'fn-empty', 'No notes published yet.'))
    return
  }

  const frag = document.createDocumentFragment()
  entries.forEach((e, i) => frag.appendChild(buildCard(e, i)))
  grid.appendChild(frag)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}
