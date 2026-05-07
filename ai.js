/**
 * ai.js — Perena systems filter + card renderer
 * Translated from PerenaSystems.jsx (React) to vanilla JS.
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
    evidenceIcon: '↗',
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
    evidenceIcon: '↗',
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
    evidenceIcon: '□',
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
    evidenceIcon: '□',
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
    evidenceIcon: '□',
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
    evidenceIcon: '□',
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
    evidenceIcon: '▦',
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
    evidenceIcon: '▦',
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
    evidenceIcon: '⊞',
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
    evidenceIcon: '□',
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

    card.innerHTML = `
      <span class="sys-card-cat">${sys.categoryLabel}</span>
      <p class="sys-card-name">${sys.name}</p>
      <p class="sys-card-desc">${sys.description}</p>
      <div class="sys-card-foot">
        <div class="sys-card-pills">
          ${sys.tools.map(t => `<span class="sys-tool-pill">${t}</span>`).join('')}
        </div>
        <span class="sys-card-evidence">${sys.evidenceType}</span>
      </div>
    `

    gridEl.appendChild(card)
  })

  countEl.textContent = `${visible.length} ${visible.length === 1 ? 'system' : 'systems'}`
}

// ── Init ──────────────────────────────────────────────────────
renderFilters()
renderCards()
