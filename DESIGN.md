# Design System — Shizudio ("The Living Catalogue")

## Product Context
- **What this is:** Personal portfolio of Shina Foo — half creative direction/growth for tech startups (currently Perena, DeFi), half fine arts (oil/acrylic painting, film photography, AI art).
- **Who it's for:** Startup founders/recruiters evaluating her for creative work, and people discovering her art.
- **Memorable thing (the yardstick):** "Artist who ships — fine-art soul, startup execution." Every design decision serves this dual identity.
- **Project type:** Editorial portfolio site (Vite, vanilla HTML/CSS/JS).
- **Reference sites:** noahmiles.framer.website, aurorix.framer.website, artemis1.framer.website — admired for hierarchy, NOT to be copied for skin. Steal the skeleton, keep the soul.

## Aesthetic Direction
- **Direction:** Editorial gallery-catalogue. Museum rigor built around a painted heart.
- **Decoration level:** Intentional. The painting and work images carry all expression; chrome stays quiet paper. One decorating device: the frame + placard treatment, applied to everything.
- **Mood:** A gallery the morning before the opening — labels straight, paint still wet. Invited, not marketed to.
- **Core principle:** The professionalism comes from the institution around the painting, not from repainting it. Cozy illustration alone reads amateur; the same illustration framed and placarded reads intentional.

## Typography
- **Display/Titles:** EB Garamond italic — the emotional register. Kept from the original site; it carries the fine-art voice.
- **Prose/Body:** EB Garamond roman, minimum 17px — for long-form (about, essays, case notes).
- **Placards/Nav/Metadata:** Fragment Mono, letterspaced (0.1–0.22em), uppercase for labels — the museum-label voice. Replaces Instrument Sans entirely (retired: it was the one generic ingredient).
- **Loading:** Google Fonts — `EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500` + `Fragment+Mono:ital@0;1`.
- **Scale:** Display clamp(2.4rem→3.6rem) · Section titles 2rem · Work titles 1.3rem · Prose 18px/1.65 · Placards 0.66–0.78rem · Nav/labels 0.62–0.68rem.

## Color
- **Approach:** Restrained, dual-pigment. Two accent colors encode the two halves of the practice; visitors learn the grammar without being told.
- **Bone `#F6F2EC`** — ground (gallery wall).
- **Gesso `#EDE6D8`** — raised panels, cards, frames.
- **Iron ink `#211B12`** — all text. Warm near-black, never #000.
- **Stone `#6B5F52`** — metadata, secondary text (WCAG AA on bone).
- **Hairline `#D8CFC0`** — borders, dividers.
- **Oxblood `#7F1F12`** — THE ART PIGMENT. Owns everything fine-art: art links, painting placards, heart cursor. (Kept from original site.)
- **Ultramarine `#2436C7`** — THE SHIPPING PIGMENT. Owns everything startup: work links, case placards, Perena. *(Amendable — flagged as a risk; drop back to oxblood-only if it fights the warmth in practice.)*
- **Frame wood `#B89F7A`** — physical frame borders only.
- **Dark mode ("lamp off"):** Bone→`#1C1712`, Gesso→`#262019`, Ink→`#EDE5D8`, Stone→`#A79A88`, Hairline→`#3A322A`, Oxblood→`#C05038`, Ultramarine→`#7D8BF0`, Frame→`#8A7455`. Strategy: warm the darks, lift the pigments for contrast, reduce saturation slightly.

## Spacing
- **Base unit:** 8px.
- **Density:** Spacious — gallery whitespace. Framed elements get generous margins.
- **Scale:** xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(72).
- **Touch targets:** minimum 44px on mobile.

## Layout
- **Approach:** Hybrid — grid-disciplined catalogue with exactly one creative-editorial moment (the framed room).
- **Landing (desktop):** masthead (name + mono nav) → italic display one-liner + mono subline → the diptych (NOW PAINTING / NOW SHIPPING panels, equal size, matching placards) → the room, framed and placarded, click to enter immersive mode.
- **Landing (mobile):** same content, single scrollable column, zero custom scroll physics. The room is a framed tappable piece; panning happens on its own page.
- **Prose column:** max 640px. Diptych/catalogue: max ~1100px.
- **Border radius:** 0 everywhere except device mocks. Frames are rectangles; galleries don't round corners.

## Motion
- **Approach:** Intentional, CSS-only (v1). Motion behaves like light in a room, not UI tricks.
- **Vocabulary:** room light shifts with visitor's local time (CSS tint overlay) · placards slide out on hover · panels lift 1–2px · crossfades.
- **Banned:** hover videos (retired — inconsistent compression/grade), count-up loaders, parallax theatrics.
- **v2 north star:** hand-painted crossfade states per room object (2–3 frames each), replacing CSS motion when the art exists.
- **Easing:** enter ease-out, exit ease-in, move ease-in-out.
- **Duration:** micro 100ms · short 200ms · medium 300–400ms · long 600ms max.

## Content Rules (the placard grammar)
- Every work — painting OR startup project — gets a museum tombstone: *Title, year · medium* (+ optional one line). Three lines max, Fragment Mono.
- Startup work is catalogued as art: "PERENA, 2024– · MEDIUM: DEFI, GROWTH, DESIGN".
- No case-study language, no capability language, no "I help X do Y" copy.
- Landing headline: short, first person, dual identity. Placeholder "I paint slow and ship fast." — *to be replaced with Shina's own words.*
- Max one sentence of atmosphere before proof of work.

## Structural Decisions (rev. 2026-07-10, evening)
| Decision | Choice | Status |
|---|---|---|
| Landing structure | **Room-first flow KEPT** (loader, tap-to-enter, expand, hotspots). Diptych integrated INTO it: latest painting composited live onto the painted easel canvas (#easel-now-overlay) + two under-frame museum placards (NOW PAINTING / NOW SHIPPING), driven by public/now.json | User-confirmed — supersedes the earlier "replace landing with diptych page" decision |
| v2.html catalogue prototype | Kept in repo as style reference only, not the landing | User-rejected as landing |
| Count-up loader | KEPT (user reversed earlier kill decision — the ritual stays) | User-confirmed |
| Mobile | Existing room interactions KEPT; placards stack in overview blank zone, fade on expand | User-confirmed |
| Memorable thing | "Artist who ships" | User-confirmed |
| Laptop diegetic overlay | NOT built — laptop is painted closed (lid only); a screenshot would read as a decal. Shipping story lives in its placard + hover | Agent finding, honors the painting |
| Ultramarine second pigment | Used only on the NOW SHIPPING placard eyebrow (one local CSS var) | Amendable, live taste test |
| Fragment Mono / headline copy | Apply only to v2 reference page, not the live site | Amendable |

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-10 | Initial design system created | /design-consultation: reference research (noahmiles/aurorix/artemis framer sites), live-site audit, blind subagent proposal, 9 user decisions. Preview: `~/.gstack/projects/shizudio-Vibabie/designs/design-system-20260710/preview.html` |
