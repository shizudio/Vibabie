/* ─────────────────────────────────────────
   i18n.js — EN / 中 language toggle
   ─────────────────────────────────────────

   The dictionary is keyed on the ENGLISH SOURCE TEXT, not on invented ids.
   That is a deliberate trade: it means no data-i18n attributes had to be
   sprayed across seventeen HTML files, and it means public/i18n/zh-CN.json
   reads like a translation worksheet — English on the left, Chinese on the
   right — which is the file Shina actually edits.

   The cost is that one English string can only ever have one Chinese
   translation site-wide. For this site that is a feature: "Work", "All works"
   and "Get in touch" SHOULD read the same everywhere. If a string ever needs
   two different translations, give one of them a data-i18n-key attribute and
   it will be keyed on that instead.

   Two kinds of key:

     html   A block element (p, h1, li…) whose only descendants are inline
            tags. Keyed on its innerHTML, so a sentence containing <a> links
            stays ONE string. Chinese word order moves the link to a different
            place in the sentence, which is impossible if you translate the
            fragments around a link separately. This is why the keys in the
            JSON have markup in them.

     text   A bare text node anywhere else.

   Plus alt / title / placeholder / aria-label, <title>, and the meta
   description.

   An empty or missing translation falls back to English, always. A half
   translated dictionary renders a half translated page, never a broken one,
   so this can ship before the copy is finished.
*/

const LANG_KEY = 'shiz-lang'
const DICT_URL = '/i18n/zh-CN.json'
const SUPPORTED = ['en', 'zh']

/* Elements whose innerHTML is the unit of translation. Anything not listed
   here is translated text-node by text-node. */
const BLOCK_SEL = [
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'li', 'figcaption', 'blockquote', 'dt', 'dd',
  '.detail-value', '.project-meta', '.project-desc', '.about-bio-lead',
].join(',')

/* Tags that may appear inside a block without disqualifying it from being
   treated as one string. A block containing anything else (a nested div, a
   figure, an img) is left to the text-node pass. */
const INLINE = new Set(['A', 'STRONG', 'EM', 'B', 'I', 'SPAN', 'BR', 'SMALL', 'SUP', 'SUB', 'CODE', 'U', 'ABBR'])

/* Never read or rewrite anything inside these. .lang-switch is here so the
   toggle does not try to translate its own EN / 中 labels. */
/* TITLE is skipped here because apply() handles document.title explicitly.
   Letting the tree walker have it too meant the walker translated the title
   first and the explicit handler then recorded the ALREADY CHINESE title as
   its English original, so the tab name could never switch back. */
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'CANVAS', 'IFRAME', 'VIDEO', 'SOURCE', 'TEMPLATE', 'CODE', 'TITLE'])
const SKIP_SEL = '.lang-switch, [data-i18n-skip]'

/* data-label* are this site's own pattern for a control that swaps its own
   caption (about-bio.js reads data-label-open / data-label-close to relabel
   the About Shina button; menu.js reads data-label). Translating the visible
   text alone would leave the button reverting to English the moment it was
   pressed, so the source attributes are translated too. */
const ATTRS = ['alt', 'title', 'placeholder', 'aria-label',
  'data-label', 'data-label-open', 'data-label-close']

const norm = (s) => String(s).replace(/\s+/g, ' ').trim()

/* Worth translating: has at least one Latin letter and some length. Filters
   out arrows, ✕, bare numerals and stray punctuation, which would otherwise
   bloat the dictionary with hundreds of untranslatable entries. */
export const worth = (s) => {
  const t = norm(s)
  return t.length >= 2 && /[A-Za-z]/.test(t)
}

const skipped = (el) => {
  for (let n = el; n; n = n.parentElement) {
    if (SKIP.has(n.tagName)) return true
    if (n.matches && n.matches(SKIP_SEL)) return true
  }
  return false
}

/* ── Key collection ─────────────────────────────────────────────────────────

   Exported because tools/i18n-extract.js runs this exact function over every
   page to generate the dictionary. Build and runtime MUST derive keys the
   same way or the lookups miss, so there is only ever one copy of this. */
/* A node that has already been translated holds its English key. It must stay
   collectable even though it now fails worth() — Chinese has no Latin letters,
   so without this check a translated node drops out of collect() entirely and
   switching back to English silently leaves it in Chinese. worth() is the
   right filter for discovering NEW source text; it is the wrong filter for
   finding text we already own. */
const pinned = (node) => node[EN_KEY] !== undefined

export function collect(root = document) {
  const entries = []
  const blocks = new Set()

  for (const el of root.querySelectorAll(BLOCK_SEL)) {
    if (skipped(el)) continue
    // Already inside a block we claimed (a <li> inside a claimed <p> cannot
    // happen, but a <p> inside a <dd> can).
    let inside = false
    for (let n = el.parentElement; n; n = n.parentElement) {
      if (blocks.has(n)) { inside = true; break }
    }
    if (inside) continue

    const kids = el.querySelectorAll('*')
    let allInline = true
    for (const k of kids) {
      if (!INLINE.has(k.tagName)) { allInline = false; break }
    }
    if (!allInline) continue
    if (!worth(el.textContent) && !pinned(el)) continue

    const key = el.dataset.i18nKey || norm(el.innerHTML)
    entries.push({ kind: 'html', el, key })
    blocks.add(el)
  }

  // Owner document, not `document` — the extractor runs collect() over pages
  // parsed by DOMParser, which belong to a different document entirely.
  const doc = root.ownerDocument || root
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement
      if (!p || skipped(p)) return NodeFilter.FILTER_REJECT
      for (let a = p; a; a = a.parentElement) {
        if (blocks.has(a)) return NodeFilter.FILTER_REJECT
      }
      return (worth(n.nodeValue) || pinned(n)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })
  let n
  while ((n = walker.nextNode())) {
    entries.push({ kind: 'text', node: n, key: norm(n.nodeValue) })
  }

  for (const el of root.querySelectorAll(`[${ATTRS.join('],[')}]`)) {
    if (skipped(el)) continue
    for (const a of ATTRS) {
      const v = el.getAttribute(a)
      const already = el[EN_ATTR_KEY] && el[EN_ATTR_KEY][a] !== undefined
      if (v && (worth(v) || already)) entries.push({ kind: 'attr', el, attr: a, key: norm(v) })
    }
  }

  return entries
}

/* ── Apply ──────────────────────────────────────────────────────────────── */

/* The English original is stashed on the node the first time it is touched,
   so switching back is a restore rather than a reverse-translation. Without
   this, toggling zh → en → zh on a page whose dictionary later changed would
   leave stale Chinese on screen. */
const EN_HTML = Symbol('en-html')
const EN_TEXT = Symbol('en-text')
const EN_ATTR = Symbol('en-attr')

/* The English key, pinned to the node the first time it is translated.

   Without this the second apply() silently undoes the first. collect() derives
   a key from whatever the node currently says, so once a node holds Chinese
   its derived key is the Chinese string, which is not in the dictionary, so it
   falls back to English. Any DOM touch that re-triggers apply — about-bio.js
   setting the toggle's label, the work grid rendering — reverted the page.

   So: derive the key once, from English, and never again. */
const EN_KEY = Symbol('en-key')
/* Separate from EN_KEY: an element can be both a translated block (scalar key)
   and carry a translated title/alt (map of per-attribute keys). One symbol for
   both would have the second overwrite the first. */
const EN_ATTR_KEY = Symbol('en-attr-key')

function keyFor(node, derived) {
  if (node[EN_KEY] === undefined) node[EN_KEY] = derived
  return node[EN_KEY]
}

let dict = null
let applying = false
let pendingReapply = null

/* Captured once, on the first apply, while the page is still English. These
   have to be read BEFORE the entries loop: an earlier version read the title
   after the loop had already translated it, recorded Chinese as the original,
   and the tab name then stayed Chinese forever. */
let enTitle = null
let enDesc = null

function headOriginals() {
  if (enTitle === null) enTitle = norm(document.title || '')
  if (enDesc === null) {
    const m = document.querySelector('meta[name="description"]')
    enDesc = m ? norm(m.getAttribute('content') || '') : null
  }
}

function apply(lang, root = document) {
  applying = true
  headOriginals()
  try {
    for (const e of collect(root)) {
      if (e.kind === 'html') {
        if (e.el[EN_HTML] === undefined) e.el[EN_HTML] = e.el.innerHTML
        const k = keyFor(e.el, e.key)
        const to = lang === 'zh' && dict ? norm(dict[k] || '') : ''
        e.el.innerHTML = to || e.el[EN_HTML]
      } else if (e.kind === 'text') {
        if (e.node[EN_TEXT] === undefined) e.node[EN_TEXT] = e.node.nodeValue
        const k = keyFor(e.node, e.key)
        const to = lang === 'zh' && dict ? norm(dict[k] || '') : ''
        e.node.nodeValue = to || e.node[EN_TEXT]
      } else {
        const store = e.el[EN_ATTR] || (e.el[EN_ATTR] = {})
        const keys = e.el[EN_ATTR_KEY] || (e.el[EN_ATTR_KEY] = {})
        if (store[e.attr] === undefined) store[e.attr] = e.el.getAttribute(e.attr)
        if (keys[e.attr] === undefined) keys[e.attr] = e.key
        const to = lang === 'zh' && dict ? norm(dict[keys[e.attr]] || '') : ''
        e.el.setAttribute(e.attr, to || store[e.attr])
      }
    }

    // <title> and the meta description sit outside the tree walk (TITLE is in
    // SKIP, and `content` is not a translated attribute). Their English is
    // captured in headOriginals() BEFORE the loop above runs.
    if (document.title) {
      const t = lang === 'zh' && dict ? norm(dict[enTitle] || '') : ''
      document.title = t || enTitle
    }
    const meta = document.querySelector('meta[name="description"]')
    if (meta && enDesc !== null) {
      const d = lang === 'zh' && dict ? norm(dict[enDesc] || '') : ''
      meta.setAttribute('content', d || enDesc)
    }
  } finally {
    applying = false
  }
}

/* ── Toggle UI ──────────────────────────────────────────────────────────────

   Injected rather than written into seventeen navs by hand. Every page has a
   .nav-links container (the index and play pages have no <nav> element, but
   they do have .nav-links), so this is the one insertion point that works
   everywhere. .nav-links is display:contents, so the switch becomes a direct
   flex child of the bar and lands at the right-hand end next to Play. */
function mountToggle(lang) {
  const host = document.querySelector('.nav-links')
  if (!host || host.querySelector('.lang-switch')) return

  const wrap = document.createElement('div')
  wrap.className = 'lang-switch'
  wrap.setAttribute('role', 'group')
  wrap.setAttribute('aria-label', 'Language / 语言')
  wrap.innerHTML =
    '<button type="button" data-lang="en">EN</button>' +
    '<span class="lang-switch-sep" aria-hidden="true">/</span>' +
    '<button type="button" data-lang="zh" lang="zh-CN">中</button>'

  wrap.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-lang]')
    if (b) setLang(b.dataset.lang)
  })

  host.appendChild(wrap)
  syncToggle(lang)
}

function syncToggle(lang) {
  for (const b of document.querySelectorAll('.lang-switch button[data-lang]')) {
    const on = b.dataset.lang === lang
    b.setAttribute('aria-pressed', String(on))
    b.classList.toggle('is-on', on)
  }
}

/* ── State ──────────────────────────────────────────────────────────────── */

function stored() {
  try {
    const v = localStorage.getItem(LANG_KEY)
    return SUPPORTED.includes(v) ? v : null
  } catch { return null }
}

function remember(lang) {
  try { localStorage.setItem(LANG_KEY, lang) } catch { /* private mode */ }
}

export async function setLang(lang) {
  if (!SUPPORTED.includes(lang)) return
  if (lang === 'zh' && !dict) {
    try {
      const res = await fetch(DICT_URL, { cache: 'no-cache' })
      dict = res.ok ? await res.json() : {}
    } catch {
      dict = {}   // offline or 404: stay English rather than blank the page
    }
    delete dict._readme
  }

  // Drop any re-apply the observer queued for the language we are leaving.
  clearTimeout(pendingReapply)

  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  document.documentElement.classList.toggle('lang-zh', lang === 'zh')
  remember(lang)
  apply(lang)
  syncToggle(lang)
  window.__shizLang = lang
}

/* Content arrives after this script runs — the work grid, the art rail and
   the project index are all fetched and rendered by other modules. Re-apply
   when the DOM settles, debounced, and never while we are the ones writing. */
function watch() {
  new MutationObserver(() => {
    if (applying || window.__shizLang !== 'zh') return
    clearTimeout(pendingReapply)
    // Re-read the language when the timer fires rather than closing over it.
    // A pending re-apply scheduled while Chinese was active used to land AFTER
    // a switch back to English and re-translate the whole page — the switch
    // looked like it simply did not work on the way back.
    pendingReapply = setTimeout(() => {
      if (window.__shizLang === 'zh') apply('zh')
    }, 60)
  }).observe(document.body, { childList: true, subtree: true })
}

function init() {
  // No stored choice: follow the browser, but only for an explicit zh locale.
  const lang = stored() || (/^zh\b/i.test(navigator.language || '') ? 'zh' : 'en')
  mountToggle(lang)
  watch()
  if (lang !== 'en') setLang(lang)
  else { document.documentElement.lang = 'en'; window.__shizLang = 'en' }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}

window.__shizI18n = { setLang, collect, worth }
