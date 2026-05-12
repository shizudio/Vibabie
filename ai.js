/**
 * ai.js — Perena systems filter + expandable card renderer
 */

const SYSTEMS = [
  {
    id: 1,
    category: 'ai',
    categoryLabel: 'AI Content',
    name: 'Claude content project',
    description:
      'Brand voice, Purple comms, and marketing copy — all runnable by the team without Shina\'s input.',
    tools: ['Claude'],
    evidenceType: 'Project link',
    howItWorks:
      'A Claude Project (Anthropic\'s persistent context workspace) pre-loaded with Perena\'s (a DeFi fintech startup I worked for) brand voice, tone guidelines, and example marketing copy. Anyone on the team opens the project, describes what they need in plain language, and gets on-brand output — no briefing required.',
  },
  {
    id: 2,
    category: 'ai',
    categoryLabel: 'AI Content',
    name: 'ChatGPT brand context',
    description:
      'Persistent brand context so any team member could generate on-brand content without a briefing.',
    tools: ['ChatGPT'],
    evidenceType: 'GPT link',
    howItWorks:
      'A custom GPT with a system prompt that embeds Perena\'s visual identity, tone of voice, and product context. The shared link gives any team member a pre-briefed AI — no setup, no reading the brand doc first. Built so the team could generate consistently without Shina in the loop.',
  },
  {
    id: 3,
    category: 'ai',
    categoryLabel: 'AI Content',
    name: 'Midjourney prompt library',
    description:
      'Curated, tested prompts for Perena\'s visual identity — moodboards, character work, campaign assets.',
    tools: ['Midjourney', 'Notion'],
    evidenceType: 'Prompt doc',
    howItWorks:
      'A Notion database with one row per tested prompt, tagged by use case — moodboard, character reference, campaign hero. Each entry stores the exact prompt string, a sample output image, and notes on what to adjust. Designed so anyone could generate on-brand visuals without needing to understand Midjourney\'s syntax.',
  },
  {
    id: 4,
    category: 'brand',
    categoryLabel: 'Brand Infrastructure',
    name: 'Brand guidelines + tone of voice',
    description:
      'Written standards for visual identity, copy tone, and brand application — so the standard held without Shina in the room.',
    tools: ['Notion', 'Figma'],
    evidenceType: 'Notion doc',
    howItWorks:
      'A Notion doc in three parts: visual identity specs (colour tokens, type rules, logo usage), copy tone (how to write, what to avoid, example sentences for different contexts), and brand application examples across social, email, and product UI. The single briefing document for any designer or writer joining the team.',
  },
  {
    id: 5,
    category: 'brand',
    categoryLabel: 'Brand Infrastructure',
    name: 'Perenimals character system',
    description:
      'Full lore, usage rules, and character guidelines for the Perenimals universe — briefable by anyone.',
    tools: ['Notion', 'Figma'],
    evidenceType: 'Character doc',
    howItWorks:
      'A Notion doc covering the full Perenimals universe: character backstories, personality traits, visual reference, and usage rules for different contexts (social, merch, campaigns). Structured so any designer or writer could brief an illustrator or generate character content without needing Shina\'s creative direction.',
  },
  {
    id: 6,
    category: 'brand',
    categoryLabel: 'Brand Infrastructure',
    name: 'Purple communication templates',
    description:
      'Full template library for every Purple touchpoint: onboarding, State of USD*, yield alerts, event invites.',
    tools: ['Claude', 'Notion'],
    evidenceType: 'Template library',
    howItWorks:
      'A Notion template library for every touchpoint in the Purple (Perena\'s stablecoin yield product) user journey: welcome onboarding, State of USD* newsletter, yield milestone alerts, VIP event invites. Each template includes subject line, body copy, and a tone note explaining the choices — so the team can adapt without breaking the voice.',
  },
  {
    id: 7,
    category: 'vip',
    categoryLabel: 'VIP Program',
    name: 'VIP relationship database',
    description:
      'Depositor history treated as relationship capital — context, preferences, and conversation history in one place.',
    tools: ['Notion'],
    evidenceType: 'DB screenshot',
    howItWorks:
      'A Notion database with one row per major depositor. Fields: deposit history, preferred comms channel, conversation log, last-touch date, next action. Treated less like a CRM and more like a relationship journal — the goal was to make every interaction feel personal even at scale.',
  },
  {
    id: 8,
    category: 'vip',
    categoryLabel: 'VIP Program',
    name: 'VIP visualizer',
    description:
      'Internal tool for visualizing Purple depositor portfolio and engagement state at a glance.',
    tools: ['Internal tool'],
    evidenceType: 'Screenshot',
    howItWorks:
      'An internal dashboard showing Purple depositor portfolio breakdown and engagement state at a glance. Built to give relationship context in 30 seconds before a call: who\'s holding what, when they last engaged, what their activity trend looks like.',
  },
  {
    id: 9,
    category: 'ops',
    categoryLabel: 'Ops',
    name: 'Daily PA system',
    description:
      'Pulls Granola, Slack, and Calendar into a structured Notion daily page. One command, full day context.',
    tools: ['Claude', 'Notion', 'Granola', 'Slack'],
    evidenceType: 'Skill package',
    howItWorks:
      'A Claude skill (a structured prompt chain) that pulls from three sources: Granola meeting transcripts, Slack thread summaries, and the day\'s calendar. One command generates a structured Notion daily page with meeting prep, outstanding threads, and a task list. Turns context-gathering from a 20-minute morning ritual into a 30-second command.',
  },
  {
    id: 10,
    category: 'ops',
    categoryLabel: 'Ops',
    name: 'PRD + designer brief templates',
    description:
      'Standardised briefs so engineers built from specs, not interpretation — and designers had real ownership.',
    tools: ['Notion'],
    evidenceType: 'Template doc',
    howItWorks:
      'Two Notion templates: a PRD for engineers (problem statement, constraints, technical spec, acceptance criteria, open questions) and a designer brief (outcome, user context, reference examples, assets needed, timeline). Built after noticing engineers were building from verbal descriptions and designers were making scope assumptions — both needed written ownership of the spec.',
  },
]

const FILTERS = [
  { key: 'all',   label: 'All' },
  { key: 'ai',    label: 'AI Content' },
  { key: 'brand', label: 'Brand Infrastructure' },
  { key: 'vip',   label: 'VIP Program' },
  { key: 'ops',   label: 'Ops' },
]

// ── State ─────────────────────────────────────────────────────
let activeFilter = 'all'

// ── DOM refs ──────────────────────────────────────────────────
const filtersEl = document.getElementById('ai-filters')
const gridEl    = document.getElementById('ai-systems-grid')
const countEl   = document.getElementById('ai-systems-count')

// ── Expand / collapse ─────────────────────────────────────────
function openCard(card) {
  const details = card.querySelector('.sys-card-details')
  if (!details) return
  card.classList.add('is-open')
  card.setAttribute('aria-expanded', 'true')
  details.style.maxHeight = details.scrollHeight + 'px'
}

function closeCard(card) {
  const details = card.querySelector('.sys-card-details')
  if (!details) return
  card.classList.remove('is-open')
  card.setAttribute('aria-expanded', 'false')
  details.style.maxHeight = '0'
}

function toggleCard(card) {
  if (card.classList.contains('is-open')) {
    closeCard(card)
  } else {
    openCard(card)
  }
}

// ── Render ────────────────────────────────────────────────────
function renderFilters() {
  filtersEl.innerHTML = ''
  FILTERS.forEach(f => {
    const btn = document.createElement('button')
    btn.className = 'ai-filter-btn' + (f.key === activeFilter ? ' active' : '')
    btn.textContent = f.label
    btn.addEventListener('click', () => {
      activeFilter = f.key
      renderFilters()
      renderCards()
    })
    filtersEl.appendChild(btn)
  })
}

function renderCards() {
  const visible = activeFilter === 'all'
    ? SYSTEMS
    : SYSTEMS.filter(s => s.category === activeFilter)

  gridEl.innerHTML = ''
  visible.forEach(sys => {
    const card = document.createElement('div')
    card.className = 'sys-card'
    card.setAttribute('tabindex', '0')
    card.setAttribute('role', 'button')
    card.setAttribute('aria-expanded', 'false')

    card.innerHTML = `
      <div class="sys-card-face">
        <div class="sys-card-head">
          <span class="sys-card-cat">${sys.categoryLabel}</span>
          <span class="sys-card-toggle" aria-hidden="true">+</span>
        </div>
        <p class="sys-card-name">${sys.name}</p>
        <p class="sys-card-desc">${sys.description}</p>
        <div class="sys-card-foot">
          <div class="sys-card-pills">
            ${sys.tools.map(t => `<span class="sys-tool-pill">${t}</span>`).join('')}
          </div>
          <span class="sys-card-evidence">${sys.evidenceType}</span>
        </div>
      </div>
      <div class="sys-card-details" style="max-height:0;overflow:hidden;">
        <div class="sys-card-details-inner">
          <p class="sys-card-how-label">How it works</p>
          <p class="sys-card-how">${sys.howItWorks}</p>
        </div>
      </div>
    `

    card.addEventListener('click', () => toggleCard(card))
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        toggleCard(card)
      }
    })

    gridEl.appendChild(card)
  })

  countEl.textContent = `${visible.length} ${visible.length === 1 ? 'system' : 'systems'}`
}

// ── Init ──────────────────────────────────────────────────────
renderFilters()
renderCards()
