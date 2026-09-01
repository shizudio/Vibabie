# Shizudio — Design System Export

Portfolio site for Shina Foo. Production: https://shizudio.me

This document is a complete, self-contained snapshot of the design system as it
exists in code today. It is written so someone with no access to the repository
can rebuild the system from it.

Stack: vanilla HTML/CSS/JS, built with Vite. Multi-page (one HTML file per page),
no framework, no component library, no CSS preprocessor. Everything below lives
in `style.css` as CSS custom properties on `:root`.

Snapshot taken: 2026-08-26.

---

## 1. Standing decisions

These are settled. They override anything that contradicts them.

**No italic. Anywhere. In any scenario.**
EB Garamond's italic was explicitly ruled out by the owner. Display type is
EB Garamond **Roman 300** — upright. Emphasis is carried by **weight and colour**,
never by slant, and never by underline / uppercase / letter-spacing (those are
other signals in this system). Every Google Fonts request is roman-only; the
`ital` axis is not loaded on any page.

A backstop rule exists for browser defaults:

```css
em, i, cite, address, dfn, var, blockquote, q { font-style: normal; }
```

It is deliberately not a blanket `* { font-style: normal !important }` — per-rule
declarations stay explicit and the cascade stays readable.

**Flat. No shadows.**
All four shadow tokens resolve to `none`, and a global rule strips any stray
`box-shadow` outside `:focus-visible`. Depth is carried by whitespace and
hairline borders, never by elevation.

**Pure white ground.**
`--paper` is `#FFFFFF`, not an off-white or cream. Backgrounds are white; the
work is what carries colour.

**The work is the hero.**
Project pages are close to wordless: a sticky nameplate rail on the left and an
uninterrupted image stack on the right. Copy is deliberately short.

---

## 2. Colour

### Core palette

| Token | Value | Role |
|---|---|---|
| `--paper` | `#FFFFFF` | Page ground, everywhere |
| `--ink` | `#1C1714` | Primary text. Warm near-black, not pure `#000` |
| `--stone` | `rgba(28,23,20,0.62)` | Secondary text — a lightness step of the ink, effective `#726F6D`, 4.99:1 |
| `--crimson` | `#7F1F12` | The single accent. Links, hover, the custom cursor |
| `--border` | `rgba(26, 23, 20, 0.09)` | Hairline rules and dividers |

Four greyscale levels, all alpha steps of one ink:
`--ink` (headings, case-study body) → `--ink-soft` 0.82 (supporting voice —
bios, ledes, rail descriptions; #45413E, 10.1:1) → `--stone` 0.62 (metadata,
captions; 4.99:1) → `--ink-faint` 0.38 (decorative ghosts only).

**Hierarchy lives in greyscale; colour means interaction.** Text levels are
steps of one ink (alpha over `--ink`), never a second hue — the old warm
brown-grey stone made secondary text do hue work and quietly competed with the
accent. Crimson appears only on things you can click or that are live (links,
hovers, the building badge); never as decoration. `--ink-faint`
(`rgba(28,23,20,0.38)`) exists for decorative-only ghost text and deliberately
fails AA — never running copy. Any text colour must clear 4.5:1.

There is exactly **one accent**. Crimson is the only saturated colour in the
interface. Everything else is ink, stone, or paper.

### Extended

| Token | Value | Role |
|---|---|---|
| `--mist` | `#EDE8E2` | Hover backgrounds — neutral warm grey |
| `--crimson-bg` | `#EDE8E2` | Alias of `--mist`, kept for back-compat |
| `--crimson-text` | `#5a3a34` | Muted crimson for text on tinted grounds |
| `--warm-grey` | `#e8e2d9` | Rare fill |
| `--border-crimson` | `rgba(127, 31, 18, 0.25)` | Underline under crimson links |

### Overlays

| Token | Value |
|---|---|
| `--overlay-dark` | `rgba(26, 22, 20, 0.94)` |
| `--paper-dim` | `rgba(255, 255, 255, 0.55)` |
| `--paper-mid` | `rgba(255, 255, 255, 0.60)` |
| `--paper-faint` | `rgba(255, 255, 255, 0.70)` |

### Reserved (declared, near-unused)

`--olive #B9B94B`, `--purple #6F4DA0`, `--amber #FCBC43`, `--teal #94D3D3`,
`--blush #EFDBE4`. These exist as tokens but are not part of the working
palette. Treat them as available, not active.

**No dark mode.** The site is light-only by design.

---

## 3. Typography

### Families

```css
--font-serif:       'EB Garamond', Georgia, serif;
--font-sans:        'Instrument Sans', sans-serif;
--font-display:     var(--font-serif);   /* alias */
--font-body:        var(--font-serif);   /* alias */
--font-description: 'Instrument Sans', sans-serif;
--font-mono:        'Courier New', Courier, monospace;
```

Two real faces:

- **EB Garamond** — display. Headings, nav, project titles. Roman only, weight 300–500.
- **Instrument Sans** — everything else. Body, labels, buttons, metadata. Weights 400–500 loaded.

Both from Google Fonts, roman axes only:

```html
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500&family=EB+Garamond:wght@300;400;500&display=swap" rel="stylesheet">
```

### Scale

All fluid via `clamp()`. Second value is the viewport-relative term.

```css
--text-xs:      clamp(0.62rem, 0.55vw, 0.70rem);  /* 10 → 11px */
--text-sm:      clamp(0.70rem, 0.70vw, 0.80rem);  /* 11 → 13px */
--text-base:    clamp(0.90rem, 1vw,    1.05rem);  /* 14 → 17px */
--text-lg:      clamp(1.10rem, 1.5vw,  1.30rem);  /* 18 → 21px */
--text-xl:      clamp(1.50rem, 2.5vw,  2.00rem);  /* 24 → 32px */
--text-display: clamp(2.40rem, 5vw,    3.80rem);  /* 38 → 61px */
```

### Roles as currently built

| Role | Family | Size | Weight | Case | Tracking | Line-height |
|---|---|---|---|---|---|---|
| Page H1 | EB Garamond | `--text-display` | 300 | sentence | 0 | 1.1 |
| Section heading | EB Garamond | `--text-xl` | 400 | sentence | 0 | 1.2 |
| Eyebrow label | Instrument Sans | `--text-sm` | **200** | **UPPERCASE** | **+0.14em** | 1.4 |
| Body | Instrument Sans | `--text-base` | 300 | sentence | 0 | 1.75–1.95 |
| Meta / tag | Instrument Sans | `--text-xs` | 300 | **UPPERCASE** | **+0.12em** | 1.5 |
| Nav link | EB Garamond | `1rem` fixed | 400 | sentence | +0.01em | — |
| Button | Instrument Sans | `--text-sm` | 500 | **UPPERCASE** | +0.06em | 1 |

### Weight distribution across the codebase

Counted across all stylesheets:

- weight `200` — 17 uses
- weight `300` — 155 uses
- weight `400` — 40 uses
- weight `500` — 6 uses
- weight `700` — 1 use

Roughly 50 rules combine `text-transform: uppercase` with positive
`letter-spacing`.

**See §8 for why this is a known problem.**

---

## 4. Spacing, radius, layout

```css
--space-xs:  4px;    --space-lg:  32px;    --space-3xl: 80px;
--space-sm:  8px;    --space-xl:  48px;    --space-4xl: 100px;
--space-md:  16px;   --space-2xl: 64px;    --gap-grid:  40px;
--space-ml:  24px;

--page-gutter:  clamp(20px, 4vw, 40px);   /* 20px mobile → 40px desktop */
--section-gap:  clamp(80px, 9vw, 144px); /* vertical rhythm between sections */

--radius-sm: 2px;    --radius-md: 4px;    --radius-lg: 6px;

--layout-content-top:        140px;
--layout-content-top-mobile: 80px;
```

**Vertical rhythm between sections.** `--section-gap` is roughly 4x the site's
internal rhythm (32px grid row gaps, heading-to-content). A section break must
read as decisively larger than any gap *inside* a section, or the page collapses
into one continuous column; 3x is not enough.

Spacing around a section heading is deliberately **asymmetric** — `--section-gap`
above, 32px below — so a heading binds to the content it labels rather than
floating between two sections. That contrast is the mechanism. Do not even it out.

Where a transition changes medium rather than just topic (a scrolling rail giving
way to a full-bleed interactive canvas), multiply: the size of the pause should
match the size of the shift.

Radii are near-square by intent — 2–6px, never pill-rounded except on buttons,
which are fully round (`999px`).

Content column: `max-width: 1040px`, centred, `padding-inline: var(--page-gutter)`.
Global `box-sizing: border-box`, so the gutter eats into the 1040 rather than
sitting outside it. Real content width at desktop is **960px**.

### Breakpoints

```
Mobile   max-width: 767px      (375 / 390 / 480)
Tablet   768px – 1023px        (768 / 810 / 834)
Desktop  1024px+
```

767/768 is the boundary. Do not mix 767 and 768 thresholds.

### Full-bleed technique

To break a section out of the 1040px column and back in cleanly:

```css
margin-inline:  calc(50% - 50vw);
padding-inline: max(var(--page-gutter), calc(50vw - 520px));
```

The `max()` guarantees the padding can never fall below the page gutter, so the
section quietly matches the prose column on narrow screens and can never cause
horizontal overflow.

### Touch targets

All tappable elements ≥ 44 × 44px (WCAG 2.5.5). Nav links use
`min-height: 44px; display: inline-flex; align-items: center` to hit it without
visually inflating the type.

---

## 5. Motion

```css
--transition-fast:  0.2s ease;
--transition-base:  0.35s ease;
--transition-slow:  0.5s ease;
--transition-enter: cubic-bezier(0.25, 0.46, 0.45, 0.94);
```

### Page entrance

Elements carry `.fade-up` and a `--i` index that staggers them:

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(22px); }
  to   { opacity: 1; transform: translateY(0); }
}

.fade-up {
  opacity: 0;
  animation: fadeUp 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: calc(var(--i, 0) * 90ms);
}

@media (prefers-reduced-motion: reduce) {
  .fade-up { opacity: 1; animation: none; }
}
```

Usage: `<h1 class="page-h1 fade-up" style="--i:1">`. The index runs in document
order across the whole page, so sections continue each other's wave rather than
each restarting at 0.

Every animation has a `prefers-reduced-motion` guard.

### Hover

Image zoom is `transform: scale(1.03)` over
`0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94)`. Text hover is a colour shift to
crimson over `0.2s ease`. Nothing lifts, nothing shadows.

### Custom cursor

The site hides the native cursor (`cursor: none` on `html, body`) and draws its
own crimson element at `z-index: 9999`. Anything embedded in an iframe must
restore `cursor: auto` and hide its own cursor element, or two cursors render.

---

## 6. Components

### Topbar

Fixed, full width, solid white, one hairline bottom border. `min-height: 58px`
desktop / 54px mobile. Five items — the wordmark plus Work, Art, Contact, Play —
spread edge to edge.

The spread is achieved by dissolving the link wrapper:

```css
.nav-links { display: contents; }
```

so its children become direct flex children of the bar and the bar's own
`justify-content: space-between` distributes all of them evenly.

Links are EB Garamond `1rem` weight 400. `:link` and `:visited` are declared
explicitly so the browser's default purple can never show through.

**Auto-hide behaviour:** the bar slides up on scroll-down
(`transform: translateY(-100%)`, `0.28s ease`) and returns when the pointer
approaches the top of the viewport.

### Button — the pill

One button style, used for every primary action:

```css
display: inline-flex;
align-items: center;
font-family: var(--font-sans);
font-size: var(--text-sm);
font-weight: 500;
letter-spacing: 0.06em;
text-transform: uppercase;
color: #FFFFFF;
background: var(--ink);
padding: 16px 32px;
border-radius: 999px;
transition: background 0.2s ease;
```

Hover swaps background to `var(--crimson)`. There is no secondary or ghost
variant — the alternative to a pill is a plain crimson text link with a
`--border-crimson` underline.

### Project thumbnail

**16:9 is the house standard** for project thumbnails and most future project
visuals. Artwork and photography are exempt — paintings keep their own ratios.

```css
.thumb { position: relative; aspect-ratio: 16/9; overflow: hidden; }
.thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
```

The image must be absolutely positioned. Left in flow, its intrinsic height
inflates the grid row past the 16:9 wrapper.

Thumbnails default to the first image of that project's case study.

### Grid inside a full-height flex column

A grid inside a `flex: 1` container in a `100vh` layout will stretch its rows to
fill. Always set `align-content: start`.

### Case-study template

Two columns: `minmax(320px, 38%) 1fr`.

- **Left rail** — sticky, `top: 58px`. Four beats with real space between them:
  wordmark or title (44px below), scope line (30px below), description
  (max 34ch, 44px below), then the pill CTA.
- **Right stack** — a vertical column of full-width images, 10px gaps, nothing
  between them. A `.project-stack-pair` two-up grid exists for portrait media
  that would look absurd at full stack width.

Below 900px the rail unpins and stacks above the images.

### Badge

"Currently building" marker on an in-progress project tile: absolutely
positioned top-left, white pill, hairline border, crimson text, with a 5px
crimson dot that pulses on a 1.8s ease-in-out loop (guarded by
`prefers-reduced-motion`).

---

## 7. Z-index

```css
--z-cursor:   9999;
--z-tooltip:  9998;
--z-lightbox: 9990;
--z-loader:   999;
--z-nav:      50;
```

---

## 8. Known problems — read this before redesigning

This is the honest diagnosis of the system above, and the most useful part of
this document. The site was benchmarked against jameygannon.com, whose type was
measured live at 1440×900.

**The reference, for calibration.** Jamey's entire Loxstar case-study page uses
four type styles: 94px/500 (line-height 0.95, tracking −0.04em), 20px/500,
16px/500 grey, 14px/500. The homepage adds one step at 32px/400. So: five sizes
total — 96 / 32 / 20 / 16 / 14 — with big gaps and nothing in between. Body copy
is 20px at weight 500. Tracking is negative at every size. There are no uppercase
micro-labels anywhere.

Against that, four problems:

**1. The scale is bunched at the bottom.**
`--text-xs`, `--text-sm` and `--text-base` all resolve between 10px and 17px.
Three tokens fighting over seven pixels is not a hierarchy. The smallest text on
the site renders at **10px**.

**2. The weights are too light.**
Weight 300 is used 155 times and weight 200 seventeen times, against six uses of
weight 500. Light weight is a display-size luxury; at 11px in `--stone` it is
close to invisible. The reference never goes below 400.

**3. Uppercase eyebrows with positive tracking.**
About 50 rules set `text-transform: uppercase` with positive `letter-spacing` on
text at 10–13px. This is the least legible way to set small type, and it is the
most template-portfolio device on the site — it appears on every page.

**4. Tracking runs the wrong direction.**
The system tracks positive on small text and neutral on display. The reference
does the opposite: negative everywhere, most aggressively at display size.

**The synthesis:** the type is *whispering*. Light weights, tiny sizes, grey on
white, and letterspaced caps are four separate forces all pushing legibility down
at once. The intent was restraint; the result reads as timid rather than refined.

---

## 9. Proposed v2 scale — NOT YET APPLIED

A revision addressing §8 is built and under review on a branch. It keeps both
typefaces and borrows only the structural lessons. **The production site does not
use this yet.**

```css
--text-xs:      clamp(0.8125rem, 0.6vw, 0.875rem);  /* 13 → 14px  meta, tags */
--text-sm:      clamp(0.9375rem, 0.8vw, 1rem);      /* 15 → 16px  labels, buttons */
--text-base:    clamp(1.0625rem, 1.2vw, 1.25rem);   /* 17 → 20px  body */
--text-lg:      clamp(1.25rem,   1.6vw, 1.5rem);    /* 20 → 24px  large body */
--text-xl:      clamp(1.75rem,   3vw,   2.5rem);    /* 28 → 40px  section headings */
--text-display: clamp(3rem,      7vw,   5.5rem);    /* 48 → 88px  hero */
```

| Role | Current | Proposed |
|---|---|---|
| Display | 38–61px / 300 | **48–88px / 300**, −0.02em, lh 1.0 |
| Section heading | 24–32px / 400 | **28–40px / 300**, −0.015em, lh 1.15 |
| Body | 14–17px / 300 | **17–20px / 400**, lh 1.55 |
| Label | 11–13px / 200, UPPERCASE +0.14em | **15–16px / 500**, sentence case |
| Meta | 10–11px / 300, uppercase | **13–14px / 500**, sentence case |

Four governing rules:

1. **Nothing lighter than 400 below 24px.** Weight 300 survives only at display
   sizes. EB Garamond Roman 300 stays on headings — it is the owner's explicit
   pick and it is correct at 48px+.
2. **Retire the uppercase eyebrow.** Sentence case at 15–16px/500 carries the
   same meaning and can be read. Keep uppercase only where caps are genuinely
   the typographic point — a wordmark, a single-letter badge, a mono readout.
3. **Negative tracking throughout.** Display −0.02em, headings −0.015em, body and
   below −0.01em.
4. **Body line-height 1.8 → 1.55.** At 20px, 1.8 drifts and lines stop reading as
   a paragraph.

**One deliberate divergence from the reference.** Jamey's body measure is roughly
40 characters. That works because his pages are ~90% image with text confined to
a narrow rail. This site carries real prose in the About bio and the Perena case
study, so the target is **60–68ch**, not 40.

**The trade being made.** This makes the site louder. The current system is quiet
and editorial by intent, and bigger/bolder spends some of that delicacy to buy
accessibility and confidence. It is a real trade, not a free win — worth stating
explicitly to anyone extending this system.

---

## 10. Constraints for anyone building on this

- Vanilla CSS custom properties. No Tailwind, no CSS-in-JS, no preprocessor.
- Multi-page: every new page needs its own entry in `vite.config.js`
  `rollupOptions.input` or it will not build.
- Never hardcode a colour. Use the tokens.
- No shadows, no dark mode, no italic.
- Every animation needs a `prefers-reduced-motion` guard.
- Wide content (tables, image strips, code) scrolls inside its own
  `overflow-x: auto` container. The page body must never scroll horizontally.
- Contrast: 4.5:1 minimum against `--paper`.
