/**
 * portfolio-editor.js
 * Brand-aware devtool for writing portfolio case studies.
 * Toggle: Cmd+Shift+E  (Mac) / Ctrl+Shift+E (Windows/Linux)
 *
 * Features
 * - Format tab:  apply brand typography classes to any block
 * - Insert tab:  drop pre-built brand blocks at cursor
 * - Media tab:   upload images/videos, insert into page
 * - Export tab:  copy clean HTML of <main> to clipboard
 * - Floating toolbar: quick styles on text selection
 */

/* ─────────────────────────────────────────
   BRAND DEFINITIONS
   ───────────────────────────────────────── */

const STYLES = [
  {
    id: 'body',
    name: 'Body',
    tag: 'p',
    cls: 'case-body',
    previewCls: 'pe-style-preview--body',
    preview: 'Regular body paragraph. DM Sans 300, warm dark.',
  },
  {
    id: 'body-em',
    name: 'Body Italic',
    tag: 'p',
    cls: 'case-body case-body--em',
    previewCls: 'pe-style-preview--em',
    preview: 'Emphasized italic body. Quieter tone.',
  },
  {
    id: 'h2',
    name: 'Section Heading',
    tag: 'h2',
    cls: 'case-section-h2',
    previewCls: 'pe-style-preview--h2',
    preview: 'Section Heading',
  },
  {
    id: 'h3',
    name: 'Sub Heading',
    tag: 'h3',
    cls: 'case-sub-h3',
    previewCls: 'pe-style-preview--h3',
    preview: 'Sub heading — crimson',
  },
  {
    id: 'quote',
    name: 'Pull Quote',
    tag: 'blockquote',
    cls: 'case-pullquote',
    previewCls: 'pe-style-preview--quote',
    preview: 'A striking pull quote with crimson left border.',
  },
  {
    id: 'label',
    name: 'Section Label',
    tag: 'span',
    cls: 'case-section-label',
    previewCls: 'pe-style-preview--label',
    preview: 'Label / Category',
  },
  {
    id: 'thesis',
    name: 'Thesis / Intro',
    tag: 'p',
    cls: 'case-thesis',
    previewCls: 'pe-style-preview--thesis',
    preview: 'Opening thesis — italic, left border.',
  },
]

const BLOCKS = [
  {
    icon: '¶',
    label: 'Paragraph',
    html: '<p class="case-body">Start writing here...</p>',
  },
  {
    icon: 'H2',
    label: 'Heading',
    html: '<h2 class="case-section-h2">Section heading</h2>',
  },
  {
    icon: 'H3',
    label: 'Sub heading',
    html: '<h3 class="case-sub-h3">Sub heading</h3>',
  },
  {
    icon: '"',
    label: 'Pull Quote',
    html: '<blockquote class="case-pullquote">A memorable statement about this project.</blockquote>',
  },
  {
    icon: '—',
    label: 'Divider',
    html: '<div class="case-divider"></div>',
  },
  {
    icon: '#',
    label: 'Label',
    html: '<span class="case-section-label">Label</span>',
  },
  {
    icon: '◎',
    label: 'Stat Row',
    html: `<div class="case-stat-row">
  <div class="case-stat">
    <span class="case-stat-num">0</span>
    <span class="case-stat-label">Metric label</span>
  </div>
  <div class="case-stat">
    <span class="case-stat-num">0</span>
    <span class="case-stat-label">Metric label</span>
  </div>
</div>`,
  },
  {
    icon: '▭',
    label: 'Image',
    html: '<div class="case-image case-image--placeholder"><span class="case-image-caption">Image caption here</span></div>',
  },
  {
    icon: '▶',
    label: 'Video',
    html: '<div class="case-video"><video src="" autoplay muted loop playsinline></video></div>',
  },
  {
    icon: '❝',
    label: 'Italic Body',
    html: '<p class="case-body case-body--em">An emphasized, italic note.</p>',
  },
]

/* ─────────────────────────────────────────
   STATE
   ───────────────────────────────────────── */

let isOpen = false
let isEditing = false
let activeTab = 'format'
let savedRange = null
let mediaFiles = []  // { name, url, type }

/* ─────────────────────────────────────────
   INIT
   ───────────────────────────────────────── */

export function initEditor() {
  injectCSS()
  buildUI()
  bindKeys()
}

function injectCSS() {
  if (document.querySelector('link[href*="portfolio-editor"]')) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = '/portfolio-editor.css'
  document.head.appendChild(link)
}

/* ─────────────────────────────────────────
   BUILD UI
   ───────────────────────────────────────── */

function buildUI() {
  // Toggle button
  const toggle = el('button', { id: 'pe-toggle', title: 'Portfolio Editor (⌘⇧E)' }, '✏')
  toggle.addEventListener('click', togglePanel)
  document.body.appendChild(toggle)

  // Toast
  const toast = el('div', { id: 'pe-toast' })
  document.body.appendChild(toast)

  // Panel
  const panel = el('div', { id: 'pe-panel' })
  panel.innerHTML = `
    <div class="pe-header">
      <span class="pe-title">Portfolio Editor</span>
      <span id="pe-mode-badge" class="pe-mode-badge">Off</span>
    </div>
    <div class="pe-tabs">
      <button class="pe-tab active" data-tab="format">Format</button>
      <button class="pe-tab" data-tab="insert">Insert</button>
      <button class="pe-tab" data-tab="media">Media</button>
      <button class="pe-tab" data-tab="export">Export</button>
    </div>
    <div class="pe-body" id="pe-body"></div>
  `
  document.body.appendChild(panel)

  // Tab switching
  panel.querySelectorAll('.pe-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab
      panel.querySelectorAll('.pe-tab').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      renderTab()
    })
  })

  // Floating selection toolbar
  const toolbar = el('div', { id: 'pe-toolbar' })
  document.body.appendChild(toolbar)

  renderTab()
  bindSelectionToolbar()
}

/* ─────────────────────────────────────────
   RENDER TABS
   ───────────────────────────────────────── */

function renderTab() {
  const body = document.getElementById('pe-body')
  body.innerHTML = ''

  if (activeTab === 'format') renderFormatTab(body)
  else if (activeTab === 'insert') renderInsertTab(body)
  else if (activeTab === 'media') renderMediaTab(body)
  else if (activeTab === 'export') renderExportTab(body)
}

// ── FORMAT ────────────────────────────────
function renderFormatTab(body) {
  const editGroup = el('div')
  editGroup.innerHTML = `<div class="pe-group-label">Edit Mode</div>`
  const editBtn = el('button', { class: 'pe-btn' + (isEditing ? ' pe-btn--primary' : '') },
    isEditing ? '✓ Editing — click to disable' : 'Enable editing')
  editBtn.addEventListener('click', toggleEditing)
  editGroup.appendChild(editBtn)
  body.appendChild(editGroup)

  const styleGroup = el('div')
  styleGroup.innerHTML = `<div class="pe-group-label">Apply Style to Block</div>`
  const list = el('div', { class: 'pe-style-list' })

  STYLES.forEach(style => {
    const btn = el('button', { class: 'pe-style-btn', 'data-style': style.id })
    btn.innerHTML = `
      <span class="pe-style-name">${style.name}</span>
      <span class="pe-style-preview ${style.previewCls}">${style.preview}</span>
    `
    btn.addEventListener('click', () => applyStyle(style))
    list.appendChild(btn)
  })

  styleGroup.appendChild(list)
  body.appendChild(styleGroup)
}

// ── INSERT ────────────────────────────────
function renderInsertTab(body) {
  const note = el('div')
  note.innerHTML = `<div class="pe-group-label">Click a block to insert at cursor</div>`
  body.appendChild(note)

  const grid = el('div', { class: 'pe-insert-grid' })
  BLOCKS.forEach(block => {
    const btn = el('button', { class: 'pe-insert-btn' })
    btn.innerHTML = `
      <span class="pe-insert-icon">${block.icon}</span>
      <span class="pe-insert-label">${block.label}</span>
    `
    btn.addEventListener('click', () => insertBlock(block.html))
    grid.appendChild(btn)
  })
  body.appendChild(grid)
}

// ── MEDIA ─────────────────────────────────
function renderMediaTab(body) {
  const dropzone = el('div', { class: 'pe-dropzone' })
  const fileInput = el('input', { type: 'file', id: 'pe-file-input', accept: 'image/*,video/*', multiple: '' })
  dropzone.innerHTML = `
    <div class="pe-dropzone-icon">↑</div>
    <div class="pe-dropzone-text">
      <strong>Click or drop</strong> images &amp; videos here
    </div>
  `
  dropzone.addEventListener('click', () => fileInput.click())
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over') })
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'))
  dropzone.addEventListener('drop', e => {
    e.preventDefault()
    dropzone.classList.remove('drag-over')
    handleFiles(Array.from(e.dataTransfer.files))
  })
  fileInput.addEventListener('change', () => handleFiles(Array.from(fileInput.files)))

  body.appendChild(fileInput)
  body.appendChild(dropzone)

  if (mediaFiles.length > 0) {
    const listWrap = el('div')
    listWrap.innerHTML = `<div class="pe-group-label" style="margin-top:4px">Uploaded</div>`
    const list = el('div', { class: 'pe-media-list' })
    mediaFiles.forEach(f => list.appendChild(buildMediaItem(f)))
    listWrap.appendChild(list)
    body.appendChild(listWrap)
  }
}

function handleFiles(files) {
  files.forEach(file => {
    const url = URL.createObjectURL(file)
    mediaFiles.push({ name: file.name, url, type: file.type })
  })
  renderTab()
  toast('Media uploaded')
}

function buildMediaItem(f) {
  const item = el('div', { class: 'pe-media-item' })
  if (f.type.startsWith('image/')) {
    const img = el('img', { class: 'pe-media-thumb', src: f.url, alt: f.name })
    item.appendChild(img)
  } else {
    const vid = el('video', { class: 'pe-media-thumb', src: f.url, muted: '', playsinline: '' })
    item.appendChild(vid)
  }
  const info = el('div', { class: 'pe-media-info' })
  const name = el('span', { class: 'pe-media-name' }, f.name)
  const copyBtn = el('button', { class: 'pe-media-copy' }, 'Copy path')
  const insertBtn = el('button', { class: 'pe-media-insert' }, 'Insert')

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(f.url)
    toast('Path copied')
  })
  insertBtn.addEventListener('click', () => {
    const isVideo = f.type.startsWith('video/')
    const html = isVideo
      ? `<div class="case-video"><video src="${f.url}" autoplay muted loop playsinline></video></div>`
      : `<div class="case-image"><img src="${f.url}" alt="${f.name}" /></div>`
    insertBlock(html)
    toast('Inserted')
  })

  info.appendChild(name)
  info.appendChild(copyBtn)
  info.appendChild(insertBtn)
  item.appendChild(info)
  return item
}

// ── EXPORT ────────────────────────────────
function renderExportTab(body) {
  const main = document.querySelector('main, .case-main')
  const html = main ? formatHTML(main.innerHTML) : '<!-- no <main> found -->'

  const group = el('div')
  group.innerHTML = `<div class="pe-group-label">Clean HTML — ready to paste</div>`

  const textarea = el('textarea', { class: 'pe-export-textarea', readonly: '' }, html)
  textarea.addEventListener('focus', () => textarea.select())

  const actions = el('div', { class: 'pe-export-actions' })

  const copyBtn = el('button', { class: 'pe-btn pe-btn--primary' }, 'Copy to clipboard')
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(html)
    toast('HTML copied!')
  })

  const refreshBtn = el('button', { class: 'pe-btn' }, 'Refresh preview')
  refreshBtn.addEventListener('click', () => renderTab())

  actions.appendChild(copyBtn)
  actions.appendChild(refreshBtn)
  group.appendChild(textarea)
  group.appendChild(actions)
  body.appendChild(group)
}

/* ─────────────────────────────────────────
   EDITING MODE
   ───────────────────────────────────────── */

function toggleEditing() {
  isEditing = !isEditing
  const main = document.querySelector('main, .case-main')
  if (!main) return

  if (isEditing) {
    main.querySelectorAll('p, h1, h2, h3, h4, blockquote, span.case-section-label, li')
      .forEach(el => { el.contentEditable = 'true' })
    document.body.classList.add('pe-editing')
    bindMediaOverlays()
    toast('Editing enabled — click any text, hover media to edit')
  } else {
    main.querySelectorAll('[contenteditable]')
      .forEach(el => { el.removeAttribute('contenteditable') })
    document.body.classList.remove('pe-editing')
    removeMediaOverlays()
    closeDimPanel()
    toast('Editing off')
  }

  updateModeBadge()
  renderTab()
}

/* ─────────────────────────────────────────
   MEDIA OVERLAYS (on-page hover actions)
   ───────────────────────────────────────── */

function bindMediaOverlays() {
  const main = document.querySelector('main, .case-main')
  if (!main) return

  main.querySelectorAll('img, video').forEach(media => {
    if (media.closest('.pe-media-wrap')) return   // already wrapped
    wrapWithOverlay(media)
  })
}

function wrapWithOverlay(media) {
  const parent = media.parentElement
  const wrap = el('div', { class: 'pe-media-wrap' })
  parent.insertBefore(wrap, media)
  wrap.appendChild(media)

  const overlay = el('div', { class: 'pe-media-overlay' })

  // Replace
  const replaceBtn = el('button', { class: 'pe-media-action' }, '↺ Replace')
  const replaceInput = el('input', { type: 'file', accept: 'image/*,video/*', style: 'display:none' })
  replaceInput.addEventListener('change', () => {
    const file = replaceInput.files[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    if (media.tagName === 'IMG') media.src = url
    else { media.src = url; media.load(); media.play?.() }
    toast('Media replaced')
  })
  replaceBtn.addEventListener('click', e => { e.stopPropagation(); replaceInput.click() })
  overlay.appendChild(replaceInput)
  overlay.appendChild(replaceBtn)

  // Dimensions / Crop
  const dimBtn = el('button', { class: 'pe-media-action' }, '⤢ Dimensions')
  dimBtn.addEventListener('click', e => {
    e.stopPropagation()
    openDimPanel(media, wrap)
  })
  overlay.appendChild(dimBtn)

  // Delete
  const delBtn = el('button', { class: 'pe-media-action pe-media-action--delete' }, '✕ Delete')
  delBtn.addEventListener('click', e => {
    e.stopPropagation()
    // Remove the whole case-image / case-video wrapper if it's just a media shell
    const container = wrap.closest('.case-image, .case-video') || wrap
    container.remove()
    closeDimPanel()
    toast('Deleted')
  })
  overlay.appendChild(delBtn)

  wrap.appendChild(overlay)
}

function removeMediaOverlays() {
  document.querySelectorAll('.pe-media-wrap').forEach(wrap => {
    const media = wrap.querySelector('img, video')
    if (media) wrap.replaceWith(media)
    else wrap.remove()
  })
}

/* ─────────────────────────────────────────
   DIMENSION / CROP PANEL
   ───────────────────────────────────────── */

let dimTarget = null   // the img or video element being edited
let aspectLocked = true

const CROP_POSITIONS = [
  ['top left',    'top center',    'top right'],
  ['center left', 'center',        'center right'],
  ['bottom left', 'bottom center', 'bottom right'],
]

function openDimPanel(media, wrap) {
  dimTarget = media
  let panel = document.getElementById('pe-dim-panel')

  if (!panel) {
    panel = buildDimPanel()
    document.body.appendChild(panel)
  }

  // Populate current values
  const cs = getComputedStyle(media)
  panel.querySelector('#pe-w').value  = media.style.width  || Math.round(media.getBoundingClientRect().width)  + 'px'
  panel.querySelector('#pe-h').value  = media.style.height || Math.round(media.getBoundingClientRect().height) + 'px'
  panel.querySelector('#pe-fit').value = media.style.objectFit || cs.objectFit || 'cover'

  // Highlight active crop cell
  const pos = (media.style.objectPosition || cs.objectPosition || 'center').toLowerCase()
  panel.querySelectorAll('.pe-crop-cell').forEach(c => {
    c.classList.toggle('active', c.dataset.pos === pos || (pos.includes('center') && c.dataset.pos === 'center'))
  })

  // Position panel near the wrap
  const rect = wrap.getBoundingClientRect()
  panel.style.top  = `${Math.min(rect.bottom + window.scrollY + 8, window.scrollY + window.innerHeight - 360)}px`
  panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 256))}px`
  panel.classList.add('open')
}

function buildDimPanel() {
  const panel = el('div', { id: 'pe-dim-panel' })

  // Header
  const hdr = el('div', { class: 'pe-dim-header' })
  hdr.appendChild(el('span', { class: 'pe-dim-title' }, 'Dimensions & Crop'))
  const closeBtn = el('button', { class: 'pe-dim-close' }, '×')
  closeBtn.addEventListener('click', closeDimPanel)
  hdr.appendChild(closeBtn)
  panel.appendChild(hdr)

  // Width + Height with lock
  const sizeRow = el('div', { class: 'pe-dim-row' })

  const wField = el('div', { class: 'pe-dim-field' })
  wField.appendChild(el('span', { class: 'pe-dim-label' }, 'Width'))
  const wInput = el('input', { class: 'pe-dim-input', id: 'pe-w', placeholder: 'e.g. 100%' })
  wField.appendChild(wInput)

  const lockBtn = el('button', { class: 'pe-lock-btn' + (aspectLocked ? ' locked' : ''), id: 'pe-lock', title: 'Lock aspect ratio' }, '⇔')
  lockBtn.addEventListener('click', () => {
    aspectLocked = !aspectLocked
    lockBtn.classList.toggle('locked', aspectLocked)
    lockBtn.textContent = aspectLocked ? '⇔' : '↕'
  })

  const hField = el('div', { class: 'pe-dim-field' })
  hField.appendChild(el('span', { class: 'pe-dim-label' }, 'Height'))
  const hInput = el('input', { class: 'pe-dim-input', id: 'pe-h', placeholder: 'e.g. auto' })
  hField.appendChild(hInput)

  // Aspect ratio sync
  wInput.addEventListener('input', () => {
    if (!aspectLocked || !dimTarget) return
    const ratio = dimTarget.naturalHeight / dimTarget.naturalWidth || dimTarget.videoHeight / dimTarget.videoWidth
    if (!ratio) return
    const wVal = parseFloat(wInput.value)
    if (!isNaN(wVal) && wInput.value.includes('px')) hInput.value = Math.round(wVal * ratio) + 'px'
  })

  sizeRow.appendChild(wField)
  sizeRow.appendChild(lockBtn)
  sizeRow.appendChild(hField)
  panel.appendChild(sizeRow)

  // Object-fit
  const fitField = el('div', { class: 'pe-dim-field' })
  fitField.appendChild(el('span', { class: 'pe-dim-label' }, 'Object Fit'))
  const fitSelect = el('select', { class: 'pe-dim-select', id: 'pe-fit' })
  ;['cover', 'contain', 'fill', 'none', 'scale-down'].forEach(v => {
    const opt = document.createElement('option')
    opt.value = v; opt.textContent = v
    fitSelect.appendChild(opt)
  })
  fitField.appendChild(fitSelect)
  panel.appendChild(fitField)

  // Crop position grid
  const cropWrap = el('div', { class: 'pe-dim-field' })
  cropWrap.appendChild(el('span', { class: 'pe-dim-label' }, 'Crop Position'))
  const grid = el('div', { class: 'pe-crop-grid' })
  CROP_POSITIONS.forEach(row => {
    row.forEach(pos => {
      const cell = el('button', { class: 'pe-crop-cell', 'data-pos': pos })
      cell.title = pos
      cell.addEventListener('click', () => {
        grid.querySelectorAll('.pe-crop-cell').forEach(c => c.classList.remove('active'))
        cell.classList.add('active')
      })
      grid.appendChild(cell)
    })
  })
  cropWrap.appendChild(grid)
  panel.appendChild(cropWrap)

  // Apply
  const applyBtn = el('button', { class: 'pe-dim-apply' }, 'Apply')
  applyBtn.addEventListener('click', applyDimensions)
  panel.appendChild(applyBtn)

  return panel
}

function applyDimensions() {
  if (!dimTarget) return
  const wVal  = document.getElementById('pe-w')?.value.trim()
  const hVal  = document.getElementById('pe-h')?.value.trim()
  const fit   = document.getElementById('pe-fit')?.value
  const activeCell = document.querySelector('.pe-crop-cell.active')
  const pos   = activeCell?.dataset.pos || 'center'

  if (wVal) dimTarget.style.width = wVal
  if (hVal) dimTarget.style.height = hVal
  if (fit)  dimTarget.style.objectFit = fit
  dimTarget.style.objectPosition = pos

  toast('Dimensions applied')
}

function closeDimPanel() {
  const panel = document.getElementById('pe-dim-panel')
  panel?.classList.remove('open')
  dimTarget = null
}

function updateModeBadge() {
  const badge = document.getElementById('pe-mode-badge')
  if (!badge) return
  badge.textContent = isEditing ? 'Editing' : 'Off'
  badge.classList.toggle('live', isEditing)
}

/* ─────────────────────────────────────────
   APPLY STYLE
   ───────────────────────────────────────── */

function applyStyle(style) {
  // Try focused element first, then last saved selection
  let target = document.activeElement
  if (!target || !document.querySelector('main, .case-main')?.contains(target)) {
    if (savedRange) {
      target = savedRange.commonAncestorContainer
      if (target.nodeType === 3) target = target.parentElement
    }
  }
  if (!target) { toast('Click a text block first'); return }

  // Walk up to a block-level element inside main
  const main = document.querySelector('main, .case-main')
  let block = target
  while (block && block !== main && isInline(block)) {
    block = block.parentElement
  }
  if (!block || block === main) { toast('Click a text block first'); return }

  // Change tag if needed
  if (block.tagName.toLowerCase() !== style.tag) {
    const newEl = document.createElement(style.tag)
    newEl.innerHTML = block.innerHTML
    newEl.className = style.cls
    block.replaceWith(newEl)
    newEl.focus()
  } else {
    block.className = style.cls
  }

  toast(`Applied: ${style.name}`)
}

function isInline(el) {
  const tag = el.tagName?.toLowerCase()
  return ['span', 'a', 'strong', 'em', 'b', 'i', 'u', 'code'].includes(tag)
}

/* ─────────────────────────────────────────
   INSERT BLOCK
   ───────────────────────────────────────── */

function insertBlock(html) {
  if (!isEditing) {
    toggleEditing()
  }

  const main = document.querySelector('main, .case-main')
  if (!main) return

  // Find insertion point
  let anchor = null
  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0) {
    let node = sel.getRangeAt(0).commonAncestorContainer
    if (node.nodeType === 3) node = node.parentElement
    // Walk up until direct child of main
    while (node && node.parentElement !== main) {
      node = node.parentElement
    }
    if (node && node !== main) anchor = node
  }

  const wrapper = document.createElement('div')
  wrapper.innerHTML = html.trim()
  const newNode = wrapper.firstElementChild

  if (anchor) {
    anchor.insertAdjacentElement('afterend', newNode)
  } else {
    main.appendChild(newNode)
  }

  // Make editable if in edit mode
  if (isEditing) {
    newNode.querySelectorAll('p, h2, h3, blockquote, span.case-section-label, li')
      .forEach(el => { el.contentEditable = 'true' })
    if (newNode.isContentEditable) newNode.focus()
    else newNode.querySelector('[contenteditable]')?.focus()
  }

  // Attach media overlays to any new img/video
  if (isEditing) {
    newNode.querySelectorAll('img, video').forEach(m => {
      if (!m.closest('.pe-media-wrap')) wrapWithOverlay(m)
    })
  }

  newNode.scrollIntoView({ behavior: 'smooth', block: 'center' })
  toast('Block inserted')
}

/* ─────────────────────────────────────────
   FLOATING SELECTION TOOLBAR
   ───────────────────────────────────────── */

const QUICK_STYLES = [
  { label: 'Body', style: STYLES.find(s => s.id === 'body') },
  { label: 'Italic', style: STYLES.find(s => s.id === 'body-em') },
  { label: 'H2', style: STYLES.find(s => s.id === 'h2') },
  { label: 'H3', style: STYLES.find(s => s.id === 'h3') },
  { label: 'Quote', style: STYLES.find(s => s.id === 'quote') },
]

function bindSelectionToolbar() {
  document.addEventListener('selectionchange', () => {
    if (!isEditing) return
    const sel = window.getSelection()
    const toolbar = document.getElementById('pe-toolbar')
    if (!toolbar) return

    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      toolbar.classList.remove('visible')
      return
    }

    // Only show toolbar when selection is inside the case-main
    const main = document.querySelector('main, .case-main')
    if (!main) return
    const range = sel.getRangeAt(0)
    if (!main.contains(range.commonAncestorContainer)) {
      toolbar.classList.remove('visible')
      return
    }

    savedRange = range.cloneRange()

    // Position toolbar above selection
    const rect = range.getBoundingClientRect()
    toolbar.style.left = `${rect.left + rect.width / 2 - toolbar.offsetWidth / 2}px`
    toolbar.style.top  = `${rect.top + window.scrollY - toolbar.offsetHeight - 10}px`

    // Build buttons once
    if (!toolbar.dataset.built) {
      QUICK_STYLES.forEach((qs, i) => {
        if (i > 0) toolbar.appendChild(el('div', { class: 'pe-tb-sep' }))
        const btn = el('button', { class: 'pe-tb-btn' }, qs.label)
        btn.addEventListener('mousedown', e => {
          e.preventDefault()
          applyStyle(qs.style)
        })
        toolbar.appendChild(btn)
      })
      toolbar.dataset.built = '1'
    }

    toolbar.classList.add('visible')
    // Clamp to viewport
    const tbRect = toolbar.getBoundingClientRect()
    if (tbRect.left < 8) toolbar.style.left = '8px'
    if (tbRect.right > window.innerWidth - 8) {
      toolbar.style.left = `${window.innerWidth - toolbar.offsetWidth - 8}px`
    }
  })
}

/* ─────────────────────────────────────────
   PANEL TOGGLE
   ───────────────────────────────────────── */

function togglePanel() {
  isOpen = !isOpen
  document.getElementById('pe-panel')?.classList.toggle('open', isOpen)
  document.getElementById('pe-toggle')?.classList.toggle('active', isOpen)
}

/* ─────────────────────────────────────────
   KEYBOARD SHORTCUT
   ───────────────────────────────────────── */

function bindKeys() {
  document.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault()
      togglePanel()
    }
    // Escape to close
    if (e.key === 'Escape' && isOpen) togglePanel()
  })
}

/* ─────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────── */

function el(tag, attrs = {}, text = '') {
  const node = document.createElement(tag)
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v
    else node.setAttribute(k, v)
  })
  if (text) node.textContent = text
  return node
}

function toast(msg) {
  const t = document.getElementById('pe-toast')
  if (!t) return
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(t._timer)
  t._timer = setTimeout(() => t.classList.remove('show'), 2200)
}

function formatHTML(html) {
  // Minimal pretty-print: add newlines after closing block tags
  return html
    .replace(/>\s+</g, '>\n<')
    .replace(/<\/(p|h[1-6]|div|section|blockquote|ul|ol|li)>/g, '</$1>\n')
    .trim()
}
