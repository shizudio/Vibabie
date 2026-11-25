# Agent guide — shizudio.me

For any coding agent working in this repo, Claude or otherwise. Claude Code
reads `CLAUDE.md`; this file is the same map for everything else, and points
at the same documents rather than repeating them.

## Read these first

| File | What it governs |
|---|---|
| `CLAUDE.md` | Branch flow, dev server, skill routing |
| `DESIGN.md` | Type, colour, spacing, the visual rules. Read before any UI change |
| `AGENT_POLICY.md` | How Shina delegates work between sessions |

## The stack, in one paragraph

Vite multi-page app, vanilla HTML/CSS/ES modules, no framework. Every page is
a root-level `.html` with its own entry in `vite.config.js` under
`rollupOptions.input`; a new page that is not registered there will not build.
Content lives in JSON manifests under `public/` and is fetched at runtime by
per-page modules. Deployed on Vercel with `cleanUrls: true`, so `about.html`
serves at `/about`. React and Tailwind appear in `package.json` but are not
wired into the build and nothing on the live site uses them.

## Task workflows

Written as markdown under `.claude/skills/`. The directory is named for Claude
but the files are plain prose with no Claude-specific syntax beyond a small
YAML header, so read them directly whatever you are.

| Workflow | File | Entry point |
|---|---|---|
| Add a Field Note from a link | `.claude/skills/field-note/SKILL.md` | `node field-note-new.js` |
| Change the profile picture | `.claude/skills/portrait/SKILL.md` | `node add-portrait.js` |

**If you cannot write a pasted image to disk**, ask Shina for a path or a
URL. `add-portrait.js` takes either, so a link to the photo anywhere that
serves one is enough; it fetches, validates and cleans up after itself. Both
scripts resolve their output against the repo, so you can run them from any
working directory.

Other scripts worth knowing, each documented in its own header comment:

- `optimize-art.js`, `sync-art.js` — the artwork pipeline for `/art`
- `sanctum-brand-placeholders.js` — regenerates placeholder imagery for that
  case study
- `vite-plugin-field-notes.js` — generates the Field Notes index and mirrors
  the production URL rewrite in dev

## House rules that bite

- **No em dashes in Field Notes.** The rest of the site uses them; that
  section does not. The indexer and `field-note-new.js` both warn.
- **No italic anywhere**, in any language. Emphasis is weight and colour.
- **Crimson means interaction**, never decoration. Hierarchy is greyscale.
- **Never animate against native scroll.** No `preventDefault` on wheel or
  touch, no `window.scrollTo` during a gesture, passive listeners only.
- **Credit is structural in Field Notes.** The creator's name and link appear
  on the card, at the top of the entry, and in the closing block. An entry
  without a creator is not publishable, and project assets are never copied
  or hotlinked: use a screenshot of the public page.
- **Nothing is live until it is deployed.** The site is static. Expect about
  ninety seconds of Vercel build after a push, and check `dist/` rather than
  trusting a green build: a reference can resolve in dev and 404 in
  production.

## Branches

`staging` for review, `main` for production, and never push straight to
`main` unless asked. See `CLAUDE.md` for the exact flow.
