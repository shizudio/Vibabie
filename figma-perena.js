// ─────────────────────────────────────────────────────────────────
// Perena Case Study — Figma Plugin Script
// Paste into: Plugins → Development → Open Console
// ─────────────────────────────────────────────────────────────────

(async () => {

// ── COLOURS ──────────────────────────────────────────────────────
const C = {
  paper:    { r: 1.000, g: 0.980, b: 0.957 },   // #FFFAF4
  ink:      { r: 0.102, g: 0.086, b: 0.078 },   // #1a1614
  body:     { r: 0.290, g: 0.255, b: 0.243 },   // #4a413e
  label:    { r: 0.420, g: 0.373, b: 0.361 },   // #6b5f5c
  stone:    { r: 0.643, g: 0.612, b: 0.608 },   // #A49C9B
  border:   { r: 0.910, g: 0.878, b: 0.847 },   // #e8e0d8
  crimson:  { r: 0.498, g: 0.122, b: 0.071 },   // #7F1F12
  crimsonT: { r: 0.353, g: 0.227, b: 0.204 },   // #5a3a34
  white:    { r: 1.000, g: 1.000, b: 1.000 },
}

// ── FONT LOADER ───────────────────────────────────────────────────
async function loadFonts() {
  await Promise.all([
    figma.loadFontAsync({ family: "EB Garamond", style: "Regular" }),
    figma.loadFontAsync({ family: "EB Garamond", style: "Italic" }),
    figma.loadFontAsync({ family: "EB Garamond", style: "Medium Italic" }),
    figma.loadFontAsync({ family: "DM Sans", style: "Light" }),
    figma.loadFontAsync({ family: "DM Sans", style: "Regular" }),
  ])
}
await loadFonts()

// ── HELPERS ───────────────────────────────────────────────────────
function solid(color, opacity = 1) {
  return [{ type: 'SOLID', color, opacity }]
}

function txt(content, { family = "DM Sans", style = "Light", size = 14, color = C.body, align = "LEFT", lineH = 28, letterSpacing = 0 } = {}) {
  const t = figma.createText()
  t.fontName = { family, style }
  t.fontSize = size
  t.characters = content
  t.fills = solid(color)
  t.textAlignHorizontal = align
  t.lineHeight = { unit: 'PIXELS', value: lineH }
  if (letterSpacing) t.letterSpacing = { unit: 'PIXELS', value: letterSpacing }
  return t
}

function rect({ w, h, color = C.border, radius = 0, dash = false }) {
  const r = figma.createRectangle()
  r.resize(w, h)
  r.fills = solid(color)
  r.cornerRadius = radius
  if (dash) {
    r.fills = [{ type: 'SOLID', color: C.paper }]
    r.strokes = solid(C.border)
    r.strokeWeight = 1.5
    r.dashPattern = [8, 6]
    r.strokeAlign = 'INSIDE'
  }
  return r
}

function hLine(w) {
  const l = figma.createLine()
  l.resize(w, 0)
  l.strokes = solid(C.border)
  l.strokeWeight = 1
  return l
}

function placeholder(w, h, label = '') {
  const frame = figma.createFrame()
  frame.resize(w, h)
  frame.fills = solid(C.paper)
  frame.strokes = solid(C.border)
  frame.strokeWeight = 1.5
  frame.dashPattern = [8, 6]
  frame.strokeAlign = 'INSIDE'
  frame.cornerRadius = 6
  if (label) {
    const t = txt(label.toUpperCase(), { size: 10, color: C.stone, align: 'CENTER', lineH: 16, letterSpacing: 1.2 })
    t.textAutoResize = 'WIDTH_AND_HEIGHT'
    frame.appendChild(t)
    t.x = (w - t.width) / 2
    t.y = (h - t.height) / 2
  }
  return frame
}

function vFrame(name, gap = 0) {
  const f = figma.createFrame()
  f.name = name
  f.layoutMode = 'VERTICAL'
  f.itemSpacing = gap
  f.primaryAxisSizingMode = 'AUTO'
  f.counterAxisSizingMode = 'AUTO'
  f.fills = []
  f.clipsContent = false
  return f
}

function pill(label) {
  const f = figma.createFrame()
  f.layoutMode = 'HORIZONTAL'
  f.primaryAxisSizingMode = 'AUTO'
  f.counterAxisSizingMode = 'AUTO'
  f.paddingLeft = f.paddingRight = 12
  f.paddingTop = f.paddingBottom = 5
  f.cornerRadius = 100
  f.fills = solid(C.paper)
  f.strokes = solid(C.border)
  f.strokeWeight = 1
  f.strokeAlign = 'INSIDE'
  const t = txt(label, { size: 11, color: C.label, letterSpacing: 0.8, lineH: 16 })
  t.textAutoResize = 'WIDTH_AND_HEIGHT'
  f.appendChild(t)
  return f
}

// ── PAGE FRAME ────────────────────────────────────────────────────
const PAGE_W = 1440
const COL_W  = 680
const COL_X  = (PAGE_W - COL_W) / 2   // 380

// Find a clear x position to the right of existing frames
const existing = figma.currentPage.children
let startX = 200
if (existing.length > 0) {
  const rightmost = Math.max(...existing.map(n => n.x + (n.width || 0)))
  startX = rightmost + 160
}

const page = figma.createFrame()
page.name = "Perena — Case Study"
page.resize(PAGE_W, 100)  // height grows as we add content
page.fills = solid(C.paper)
page.x = startX
page.y = 0
figma.currentPage.appendChild(page)

let cursorY = 0

function add(node, x = 0, customY = null) {
  page.appendChild(node)
  node.x = x
  node.y = customY !== null ? customY : cursorY
  return node
}

function gap(px) { cursorY += px }

// ──────────────────────────────────────────────────────────────────
// A. NAV BAR
// ──────────────────────────────────────────────────────────────────
const nav = figma.createFrame()
nav.resize(PAGE_W, 64)
nav.fills = solid(C.paper, 0)
nav.name = "Nav"
page.appendChild(nav)
nav.x = 0
nav.y = 0

const navLogo = txt("Shina Foo", { family: "EB Garamond", style: "Italic", size: 18, color: C.crimson, lineH: 24 })
navLogo.textAutoResize = 'WIDTH_AND_HEIGHT'
nav.appendChild(navLogo)
navLogo.x = COL_X
navLogo.y = (64 - navLogo.height) / 2

const navPage = txt("Perena", { size: 12, color: C.stone, lineH: 16, letterSpacing: 1 })
navPage.textAutoResize = 'WIDTH_AND_HEIGHT'
nav.appendChild(navPage)
navPage.x = COL_X + COL_W - navPage.width
navPage.y = (64 - navPage.height) / 2

cursorY = 64

// ──────────────────────────────────────────────────────────────────
// B. BACK LINK
// ──────────────────────────────────────────────────────────────────
gap(56)
const back = txt("← Work & Projects", { size: 11, color: C.label, lineH: 16, letterSpacing: 1.4 })
back.textAutoResize = 'WIDTH_AND_HEIGHT'
add(back, COL_X)
cursorY += back.height

// ──────────────────────────────────────────────────────────────────
// C. HEADER
// ──────────────────────────────────────────────────────────────────
gap(32)

// Page label
const pageLabel = txt("THE LAPTOP — WORK & PROJECTS", { size: 10, color: C.label, lineH: 16, letterSpacing: 2 })
pageLabel.textAutoResize = 'WIDTH_AND_HEIGHT'
add(pageLabel, COL_X)
cursorY += pageLabel.height + 14

// H1
const h1 = txt("Perena", { family: "EB Garamond", style: "Italic", size: 80, color: C.ink, lineH: 88, align: "LEFT" })
h1.textAutoResize = 'WIDTH_AND_HEIGHT'
add(h1, COL_X)
cursorY += h1.height + 20

// Meta row
const meta = txt("Head of Growth & Creative Director  ·  2024 – 2026  ·  perena.org ↗", { size: 11, color: C.label, lineH: 18, letterSpacing: 1.2 })
meta.textAutoResize = 'WIDTH_AND_HEIGHT'
add(meta, COL_X)
cursorY += meta.height + 32

// Thesis — left border
const thesisBorder = rect({ w: 2, h: 60, color: C.border })
add(thesisBorder, COL_X)

const thesis = txt("In a market where every protocol competes on yield,\nthe differentiator is experience.", {
  family: "EB Garamond", style: "Italic", size: 20, color: C.label, lineH: 33, align: "LEFT"
})
thesis.textAutoResize = 'WIDTH_AND_HEIGHT'
thesis.resize(COL_W - 24, thesis.height)
add(thesis, COL_X + 20)
thesis.y = thesisBorder.y

// sync thesis border height
thesisBorder.resize(2, thesis.height + 8)

cursorY = thesis.y + thesis.height + 64

// ──────────────────────────────────────────────────────────────────
// D. HERO IMAGE PLACEHOLDER
// ──────────────────────────────────────────────────────────────────
const hero = placeholder(COL_W, Math.round(COL_W * 9 / 16), "Hero image — Perena cover")
add(hero, COL_X)
cursorY += hero.height + 64

// ──────────────────────────────────────────────────────────────────
// E. INTRO TEXT
// ──────────────────────────────────────────────────────────────────
const intro1 = txt("Perena is a DeFi yield protocol built on Solana. As a founding team member, I led a creative and design team of three to four people while owning growth, brand, product design, and business development.", {
  size: 15, color: C.body, lineH: 30
})
intro1.textAutoResize = 'HEIGHT'
intro1.resize(COL_W, intro1.height)
add(intro1, COL_X)
cursorY += intro1.height + 20

const intro2 = txt("My core belief: in a market where every protocol competes on yield, the differentiator is experience. I built that case by combining brand, product, and design decisions, turning each marketing campaign into an opportunity to bring delight to our users.", {
  size: 15, color: C.body, lineH: 30
})
intro2.textAutoResize = 'HEIGHT'
intro2.resize(COL_W, intro2.height)
add(intro2, COL_X)
cursorY += intro2.height + 64

// ──────────────────────────────────────────────────────────────────
// HELPER: Section divider
// ──────────────────────────────────────────────────────────────────
function addDivider() {
  const d = hLine(PAGE_W)
  add(d, 0)
  cursorY += 56
}

// ──────────────────────────────────────────────────────────────────
// HELPER: Section header
// ──────────────────────────────────────────────────────────────────
function addSectionHeader(labelStr, h2Str) {
  const lbl = txt(labelStr.toUpperCase(), { size: 10, color: C.label, lineH: 16, letterSpacing: 2 })
  lbl.textAutoResize = 'WIDTH_AND_HEIGHT'
  add(lbl, COL_X)
  cursorY += lbl.height + 12

  const h2 = txt(h2Str, { family: "EB Garamond", style: "Italic", size: 40, color: C.ink, lineH: 50 })
  h2.textAutoResize = 'HEIGHT'
  h2.resize(COL_W, h2.height)
  add(h2, COL_X)
  cursorY += h2.height + 32
}

// ──────────────────────────────────────────────────────────────────
// HELPER: Body paragraph
// ──────────────────────────────────────────────────────────────────
function addBody(str, color = C.body) {
  const t = txt(str, { size: 15, color, lineH: 30 })
  t.textAutoResize = 'HEIGHT'
  t.resize(COL_W, t.height)
  add(t, COL_X)
  cursorY += t.height + 20
}

// ──────────────────────────────────────────────────────────────────
// HELPER: Pull quote
// ──────────────────────────────────────────────────────────────────
function addPullQuote(str) {
  gap(16)
  const border = rect({ w: 3, h: 80, color: C.crimson })
  add(border, COL_X)

  const q = txt(str, { family: "EB Garamond", style: "Italic", size: 22, color: C.ink, lineH: 36 })
  q.textAutoResize = 'HEIGHT'
  q.resize(COL_W - 28, q.height)
  add(q, COL_X + 24)
  q.y = border.y + 4

  border.resize(3, q.height + 8)
  cursorY = q.y + q.height + 36
}

// ──────────────────────────────────────────────────────────────────
// HELPER: Stat row (3 stats)
// ──────────────────────────────────────────────────────────────────
function addStatRow(stats) {
  gap(8)
  const rowH = 100
  const colW = COL_W / stats.length
  const rowY = cursorY

  // top border
  const topLine = hLine(COL_W)
  add(topLine, COL_X)
  cursorY += 0

  stats.forEach((s, i) => {
    const statNum = txt(s.num, { family: "EB Garamond", style: "Italic", size: 48, color: C.crimson, lineH: 52 })
    statNum.textAutoResize = 'WIDTH_AND_HEIGHT'
    page.appendChild(statNum)
    statNum.x = COL_X + (colW * i) + (i === 0 ? 0 : 16)
    statNum.y = rowY + 22

    const statLabel = txt(s.label.toUpperCase(), { size: 10, color: C.label, lineH: 15, letterSpacing: 1.2 })
    statLabel.textAutoResize = 'HEIGHT'
    statLabel.resize(colW - 20, statLabel.height)
    page.appendChild(statLabel)
    statLabel.x = statNum.x
    statLabel.y = statNum.y + statNum.height + 8

    // vertical divider between stats
    if (i < stats.length - 1) {
      const divider = figma.createLine()
      divider.resize(0, rowH - 16)
      divider.rotation = 0
      page.appendChild(divider)
      divider.strokes = solid(C.border)
      divider.strokeWeight = 1
      divider.x = COL_X + colW * (i + 1)
      divider.y = rowY + 8
    }
  })

  cursorY = rowY + rowH

  // bottom border
  const botLine = hLine(COL_W)
  add(botLine, COL_X)
  cursorY += 40
}

// ──────────────────────────────────────────────────────────────────
// F. DIVIDER
// ──────────────────────────────────────────────────────────────────
addDivider()

// ──────────────────────────────────────────────────────────────────
// G. PURPLE SECTION
// ──────────────────────────────────────────────────────────────────
addSectionHeader("Product", "Perena Purple")

addBody("The product decision with the most measurable business impact was Perena Purple — the VIP program I conceived and led end-to-end, from PRD through engineering delivery to marketing launch.")

addPullQuote("20% of our depositors held 70% of our AUM. Serious users deserved a more serious experience.")

addBody("Purple was built around four improvements: an exclusive communication channel with direct access to founders and fund researchers, priority product and protocol updates, a personalised dashboard, and macro market signals paired with protocol opinion pieces.")

addBody("I personally managed relationships with over 20 depositors at the $100K+ tier through bespoke outreach that converted conversations into committed capital. To scale the operation, I built a VIP status visualiser from our depositor database and automated the content pipeline using a Claude project that transformed each communication brief into six formats for distribution across channels.")

addStatRow([
  { num: "20+",   label: "VIP depositors managed personally" },
  { num: "$100K+", label: "Minimum deposit tier" },
  { num: "6",     label: "Content formats automated per brief" },
])

addBody("The system proved its worth under pressure. During market downturns and Solana-related exploit events, we reached Purple users immediately — clarifying how their funds were or weren't affected before uncertainty turned into withdrawal decisions. Engagement built trust. Trust reduced churn.")

addBody("The long-term vision for Purple is a private banking experience built inside a DeFi protocol.", C.label)

gap(16)
const purpleImg = placeholder(COL_W, 340, "Purple dashboard & communication system — images coming")
add(purpleImg, COL_X)
cursorY += purpleImg.height + 40

// Sub-heading: Beyond Purple
const subH1 = txt("Beyond Purple", { family: "EB Garamond", style: "Italic", size: 22, color: C.crimsonT, lineH: 30 })
subH1.textAutoResize = 'WIDTH_AND_HEIGHT'
add(subH1, COL_X)
cursorY += subH1.height + 20

addBody("I operated as the translation layer between protocol mechanics and user experience — attending engineering standups to catch UX implications early, writing PRDs engineers could build from without interpretation overhead, and briefing designers with enough creative ownership that output was both fast and considered.")

addBody("I caught experience failures before they shipped: an invest page that needed filtering logic before it could scale, withdrawal copy that defaulted to USD* across all assets rather than adapting per-product. I also personally deployed several frontend features directly.")

// ──────────────────────────────────────────────────────────────────
// H. DIVIDER
// ──────────────────────────────────────────────────────────────────
gap(24)
addDivider()

// ──────────────────────────────────────────────────────────────────
// I. BRAND SECTION
// ──────────────────────────────────────────────────────────────────
addSectionHeader("Brand", "Building an Identity from a Logo and a Flower")

addBody("Given only a logo and a floral concept to start with, I built Perena's complete brand identity from the ground up — visual system, tone of voice, mascot character world, merch line, and all customer-facing content. It has since become one of the most well-liked brands in the Solana ecosystem.")

addBody("My intention was for people to remember Perena as the place where they feel safe, confident, and delighted to grow their wealth — even though we don't promise double-digit yields. The brand needed to feel emotional, personal, and categorically different.")

addPullQuote("Imagine growing your money the way you wait for a flower to bloom.")

addBody("I built Perena's identity at the intersection of two worlds that don't usually meet: the cold, hard mechanics of finance and the warmth of organic nature. Where other protocols use charts and grids, Perena uses wildflower meadows, vault doors hidden in gardens, cherry blossoms surrounding gold bars.")

// 2×2 image grid
gap(16)
const gridW = (COL_W - 12) / 2
const gridH = Math.round(gridW * 3 / 4)
const gridLabels = ["Campaign imagery", "Visual identity", "Brand collateral", "Merch & print"]
gridLabels.forEach((label, i) => {
  const col = i % 2
  const row = Math.floor(i / 2)
  const img = placeholder(gridW, gridH, label)
  page.appendChild(img)
  img.x = COL_X + col * (gridW + 12)
  img.y = cursorY + row * (gridH + 12)
})
cursorY += gridH * 2 + 12 + 40

addBody("Deep violet anchors the identity — warm enough to feel emotional, authoritative enough to feel trustworthy, deliberately far from the cold blues of corporate fintech. Gold appears as the quiet signal of value. Iridescence — glitter, shimmer, holographic light — places Perena in the digital world without a single generic web3 visual trope.")

addBody("The emotional experience I wanted to create: arriving somewhere beautiful. A private garden with a locked door — and you have the key.", C.label)

// ──────────────────────────────────────────────────────────────────
// J. DIVIDER
// ──────────────────────────────────────────────────────────────────
gap(24)
addDivider()

// ──────────────────────────────────────────────────────────────────
// K. DESIGN & MARKETING SECTION
// ──────────────────────────────────────────────────────────────────
addSectionHeader("Design & Marketing", "Building a Creative System That Outlasts Any One Person")

addBody("I built and managed a design and marketing team of four that became the creative powerhouse behind all of Perena's output: marketing and interface design, collaboration campaigns, merch design, and physical production.")

addBody("I built the infrastructure that made the creative function durable — brand guidelines, tone of voice documentation, Perenimals character rules, Purple-specific communication templates, and a VIP relationship database. When team members transitioned, the brand didn't drift and the system kept running.")

// Partnership pills
gap(8)
const partners = ["Jupiter", "LiFi Exchange", "Huma Finance", "Titan Exchange", "Sanctum", "Meteora", "Superteam"]
let pillX = COL_X
let pillY = cursorY
const pillGap = 8
partners.forEach(p => {
  const pil = pill(p)
  page.appendChild(pil)
  if (pillX + pil.width > COL_X + COL_W) {
    pillX = COL_X
    pillY += 36
  }
  pil.x = pillX
  pil.y = pillY
  pillX += pil.width + pillGap
})
cursorY = pillY + 36 + 32

// Perenimals sub-heading
const subH2 = txt("Perenimals", { family: "EB Garamond", style: "Italic", size: 22, color: C.crimsonT, lineH: 30 })
subH2.textAutoResize = 'WIDTH_AND_HEIGHT'
add(subH2, COL_X)
cursorY += subH2.height + 20

addBody("I led the creation of Perenimals — Perena's mascot universe, which grew into something larger than a brand asset. The character world became a community, then an NFT series, then a physical product line that resonated well beyond the crypto crowd.")

addStatRow([
  { num: "1hr",   label: "First NFT series sold out" },
  { num: "200+",  label: "Active NFT holders" },
  { num: "1,000", label: "Physical plushies sold" },
])

gap(8)
const perenimals = placeholder(COL_W, 340, "Perenimals character world & merch — images coming")
add(perenimals, COL_X)
cursorY += perenimals.height + 40

// Breakpoint sub-heading
const subH3 = txt("Breakpoint 2025", { family: "EB Garamond", style: "Italic", size: 22, color: C.crimsonT, lineH: 30 })
subH3.textAutoResize = 'WIDTH_AND_HEIGHT'
add(subH3, COL_X)
cursorY += subH3.height + 20

addBody("At Solana Breakpoint 2025, Perena ran one of the most-approached booths at the conference. We gifted fresh flowers from a flower cart, sold Perenimals blindboxes, and moved fashionable merch that people lined up for. None of it came from heavy sponsorship spend — it came from a brand that people already had a relationship with before they walked up.")

gap(8)
const booth = placeholder(COL_W, 340, "Breakpoint 2025 booth — images coming")
add(booth, COL_X)
cursorY += booth.height + 40

// ──────────────────────────────────────────────────────────────────
// L. DIVIDER
// ──────────────────────────────────────────────────────────────────
gap(24)
addDivider()

// ──────────────────────────────────────────────────────────────────
// M. CLOSING SECTION (centered)
// ──────────────────────────────────────────────────────────────────
gap(32)

// $30M hero stat
const aum = txt("$30M", { family: "EB Garamond", style: "Italic", size: 96, color: C.crimson, lineH: 100, align: "CENTER" })
aum.textAutoResize = 'WIDTH_AND_HEIGHT'
add(aum, COL_X + (COL_W - aum.width) / 2)
cursorY += aum.height + 8

const aumLabel = txt("ALL-TIME HIGH AUM", { size: 10, color: C.label, lineH: 16, letterSpacing: 2, align: "CENTER" })
aumLabel.textAutoResize = 'WIDTH_AND_HEIGHT'
add(aumLabel, COL_X + (COL_W - aumLabel.width) / 2)
cursorY += aumLabel.height + 48

// Closing pull quote
const closingBorder = rect({ w: 3, h: 120, color: C.crimson })
add(closingBorder, COL_X)

const closing = txt("Perena taught me that the one powerful thing a creative can do for a product is to make design decisions that show up in the numbers — and build systems that make that standard outlast any single person.", {
  family: "EB Garamond", style: "Italic", size: 20, color: C.label, lineH: 33
})
closing.textAutoResize = 'HEIGHT'
closing.resize(COL_W - 28, closing.height)
add(closing, COL_X + 24)
closing.y = closingBorder.y + 4
closingBorder.resize(3, closing.height + 8)
cursorY = closing.y + closing.height + 48

// CTA
const cta = txt("Visit perena.org ↗", { family: "EB Garamond", style: "Italic", size: 18, color: C.crimson, lineH: 24, align: "CENTER" })
cta.textAutoResize = 'WIDTH_AND_HEIGHT'
add(cta, COL_X + (COL_W - cta.width) / 2)
cursorY += cta.height + 120

// ── RESIZE PAGE FRAME TO FIT ──────────────────────────────────────
page.resize(PAGE_W, cursorY)

// ── ZOOM TO FIT ───────────────────────────────────────────────────
figma.viewport.scrollAndZoomIntoView([page])

return `✅ Perena case study built — ${cursorY}px tall`

})()
