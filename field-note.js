/**
 * field-note.js — a single Field Note.
 *
 * The slug arrives as ?slug=<name>. In production Vercel rewrites
 * /field-notes/<slug> onto this page; in dev vite-plugin-field-notes.js does
 * the same, so the pretty URL is the only one anybody ever types.
 *
 * Layout is the case-study template (project.css): the rail is the nameplate
 * and the credit, the stack is the reading. Sections render in a fixed order
 * and any section left empty in the JSON is simply skipped, so a half-written
 * note renders as a short note rather than as a page full of empty headings.
 */

const SECTIONS = [
  ['what',    'What it is'],
  ['special', 'Why it feels special'],
  ['trick',   'The key trick'],
  // Renamed from "Why it feels alive" at Shina's request. Note it sits very
  // close to "Why it feels special" above: that one is the experience, this
  // one is the mechanism underneath it.
  ['alive',   'Why so special'],
  ['stack',   'Stack'],
  ['steal',   'Steal this'],
]

const el = (tag, cls, text) => {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

function isHttpUrl(url) {
  return /^https?:\/\//.test(url || '')
}

function renderFrame(frame, index) {
  const fig = el('figure', 'fn-frame')
  const img = document.createElement('img')
  img.src = frame.src
  img.alt = frame.alt || ''
  img.decoding = 'async'
  img.loading = index === 0 ? 'eager' : 'lazy'
  if (frame.width) img.width = frame.width
  if (frame.height) img.height = frame.height
  fig.appendChild(img)

  if (frame.credit && String(frame.credit).trim()) {
    const cap = el('figcaption', 'fn-frame-credit')
    if (frame.creditUrl) {
      const a = el('a', 'fn-inline-link', frame.credit)
      a.href = frame.creditUrl
      if (isHttpUrl(frame.creditUrl)) {
        a.target = '_blank'
        a.rel = 'noopener'
      }
      cap.appendChild(a)
    } else {
      cap.textContent = frame.credit
    }
    fig.appendChild(cap)
  }
  return fig
}

function slugFromUrl() {
  const q = new URLSearchParams(location.search).get('slug')
  if (q) return q
  // Direct hit on /field-notes/<slug> with no query, if a host ever serves it
  // that way: take the last path segment.
  const m = location.pathname.match(/\/field-notes\/([^/]+)\/?$/)
  return m ? decodeURIComponent(m[1]) : ''
}

function renderMissing(stack, rail, slug) {
  rail.appendChild(el('h1', 'project-title fn-title', 'Not found'))
  rail.appendChild(el('p', 'project-desc', slug
    ? `There is no field note called "${slug}".`
    : 'No field note was requested.'))
  const back = el('a', 'project-visit', 'All field notes')
  back.href = '/field-notes'
  const actions = el('div', 'project-actions')
  actions.appendChild(back)
  rail.appendChild(actions)
}

function renderRail(rail, data) {
  rail.appendChild(el('h1', 'project-title fn-title', data.title || 'Untitled'))

  // Credit sits directly under the title, above everything else. On this page
  // the work is someone else's and the byline is the first thing read.
  if (data.creator) {
    const collection = data.kind === 'collection'
    const by = el('p', 'fn-entry-by')
    by.appendChild(el('span', 'fn-by-label', collection ? 'Collected by' : 'By'))
    if (data.creatorUrl) {
      const c = el('a', 'fn-by-name', data.creator)
      c.href = data.creatorUrl
      if (!collection || isHttpUrl(data.creatorUrl)) {
        c.target = '_blank'
        c.rel = 'noopener'
      }
      by.appendChild(c)
    } else {
      by.appendChild(el('span', 'fn-by-name', data.creator))
    }
    rail.appendChild(by)
  }

  if (data.hook) rail.appendChild(el('p', 'project-desc', data.hook))

  if (data.tags && data.tags.length) {
    const tags = el('ul', 'fn-card-tags fn-entry-tags')
    data.tags.forEach((t) => tags.appendChild(el('li', 'fn-tag', t)))
    rail.appendChild(tags)
  }

  const actions = el('div', 'project-actions')
  if (data.projectUrl) {
    const visit = el('a', 'project-visit', 'Visit the project ↗')
    visit.href = data.projectUrl; visit.target = '_blank'; visit.rel = 'noopener'
    actions.appendChild(visit)
  }
  const back = el('a', 'fn-back', 'All field notes')
  back.href = '/field-notes'
  actions.appendChild(back)
  rail.appendChild(actions)
}

function renderStack(stack, data) {
  const collection = data.kind === 'collection'

  if (collection) {
    // A stack of frames, not the single 16:9 hero.
    const frames = Array.isArray(data.frames) ? data.frames.filter((f) => f && f.src) : []
    if (!frames.length) {
      const media = el('figure', 'fn-entry-media is-empty')
      media.appendChild(el('span', 'fn-card-placeholder', 'Frames to come'))
      stack.appendChild(media)
    } else {
      frames.forEach((frame, i) => stack.appendChild(renderFrame(frame, i)))
    }
  } else {
    // Media leads. A note with no capture yet shows a named placeholder rather
    // than dropping straight into text, so the shape of the page stays the same
    // once the recording lands.
    const media = el('figure', 'fn-entry-media')
    if (data.thumbVideo) {
      const v = document.createElement('video')
      v.src = data.thumbVideo
      v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true
      v.setAttribute('aria-label', data.thumbAlt || '')
      media.appendChild(v)
    } else if (data.thumb) {
      const img = document.createElement('img')
      img.src = data.thumb
      img.alt = data.thumbAlt || ''
      media.appendChild(img)
    } else {
      media.classList.add('is-empty')
      media.appendChild(el('span', 'fn-card-placeholder', 'Recording to come'))
    }
    stack.appendChild(media)
  }

  const body = el('div', 'fn-body')
  const s = data.sections || {}
  SECTIONS.forEach(([key, label]) => {
    const text = (s[key] || '').trim()
    if (!text) return
    const block = el('section', 'fn-block')
    block.appendChild(el('h2', 'fn-block-label', label))
    block.appendChild(el('p', 'fn-block-text', text))
    body.appendChild(block)
  })

  // Credit and link, again, as a closing block. The brief asks for it on the
  // card and on the entry page; this is the entry page's explicit version,
  // separate from the byline at the top of the rail.
  if (collection) {
    if (data.creator) {
      const credit = el('section', 'fn-block fn-credit')
      credit.appendChild(el('h2', 'fn-block-label', 'Credit'))
      const p = el('p', 'fn-block-text')
      p.appendChild(document.createTextNode('Collected by '))
      if (data.creatorUrl) {
        const c = el('a', 'fn-inline-link', data.creator)
        c.href = data.creatorUrl
        if (isHttpUrl(data.creatorUrl)) {
          c.target = '_blank'
          c.rel = 'noopener'
        }
        p.appendChild(c)
      } else {
        p.appendChild(document.createTextNode(data.creator))
      }
      p.appendChild(document.createTextNode('.'))
      credit.appendChild(p)
      body.appendChild(credit)
    }
  } else if (data.creator || data.projectUrl) {
    const credit = el('section', 'fn-block fn-credit')
    credit.appendChild(el('h2', 'fn-block-label', 'Credit'))
    const p = el('p', 'fn-block-text')
    if (data.creator) {
      p.appendChild(document.createTextNode(`${data.title || 'This project'} is by `))
      if (data.creatorUrl) {
        const c = el('a', 'fn-inline-link', data.creator)
        c.href = data.creatorUrl; c.target = '_blank'; c.rel = 'noopener'
        p.appendChild(c)
      } else {
        p.appendChild(document.createTextNode(data.creator))
      }
      p.appendChild(document.createTextNode('. '))
    }
    if (data.projectUrl) {
      const l = el('a', 'fn-inline-link', 'See it live ↗')
      l.href = data.projectUrl; l.target = '_blank'; l.rel = 'noopener'
      p.appendChild(l)
    }
    credit.appendChild(p)
    body.appendChild(credit)
  }

  stack.appendChild(body)

  const foot = el('div', 'project-foot')
  const back = el('a', 'project-back', 'Field Notes')
  back.href = '/field-notes'
  foot.appendChild(back)
  stack.appendChild(foot)
}

async function init() {
  const page = document.getElementById('fnEntry')
  const rail = document.getElementById('fnRail')
  const stack = document.getElementById('fnStack')
  if (!page || !rail || !stack || page.dataset.fnReady) return
  page.dataset.fnReady = '1'

  const slug = slugFromUrl()
  let data = null
  if (slug && /^[A-Za-z0-9._-]+$/.test(slug)) {
    try {
      const res = await fetch(`/field-notes-data/${encodeURIComponent(slug)}.json`, { cache: 'no-cache' })
      if (res.ok) data = await res.json()
    } catch (e) { /* fall through to not-found */ }
  }

  page.setAttribute('aria-busy', 'false')

  if (!data) { renderMissing(stack, rail, slug); return }

  document.title = `${data.title} · Field Notes · Shina Foo`
  const meta = document.querySelector('meta[name="description"]')
  if (meta && data.kind === 'collection') {
    meta.setAttribute('content', `${data.title}. Collected by ${data.creator || 'Shina Foo'}.`)
  } else if (meta && data.hook) {
    meta.setAttribute('content', `${data.hook} A field note by Shina Foo on ${data.title}${data.creator ? ` by ${data.creator}` : ''}.`)
  }

  renderRail(rail, data)
  renderStack(stack, data)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}
