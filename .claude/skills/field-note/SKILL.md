---
name: field-note
description: Turn a link into a Field Note on shizudio.me. Use when Shina drops a URL to an interactive project, a piece of design work, or a site she likes and wants archived, or says "field note this", "add this to field notes", "new field note". Captures a thumbnail, extracts what a machine can know, then INTERVIEWS her for the prose rather than writing it.
---

# Field Note from a link

Field Notes is Shina's archive of other people's interactive work. Her brief
for it: *"my breakdown of how each one is made and what makes it work. It
shows how I see, not just what I make."*

That sentence decides how this skill behaves. **Do the extraction, never the
thinking.** An agent that writes the six prose sections produces a page about
how a model sees, which is the one thing this section must not be. Scaffold,
then ask.

## 1. Look at the project

Open the URL in the browser. Actually use it for a minute: click, drag, scroll.
You need enough to propose a hypothesis about the key trick, and to write a
truthful alt text for the capture.

Then read the source for what a machine can know:

- `view-source` or `read_page` for the libraries: three.js, GSAP, p5, Matter.js,
  Rive, Lenis, canvas, WebGL, a single HTML file vs a bundle
- the title, and the creator's name and URL (page footer, GitHub repo, the
  parent path of a `*.github.io` project)

## 2. Capture the thumbnail

Set the viewport to 16:9 (1600x900 works) and screenshot the page in a state
that shows what it DOES, not an empty landing state. For Bouquet that meant
flowers already arranged, not a blank canvas.

The screenshot tool saves a file and reports its path. That path is the
`--thumb` argument.

**Never copy assets from the project.** No images, no video, no code from
their repo, nothing hotlinked. A capture of the public page is Shina's own
screenshot. Their files are theirs.

## 3. Scaffold

```bash
node field-note-new.js --url <projectUrl> \
  --title "..." --creator "..." --creator-url "..." \
  --stack "..." --hook "One line on what it does." \
  --thumb <path from the screenshot> \
  --thumb-alt "..."
```

Leave `tags` empty unless Shina asks for them; she removed them from Bouquet.

The six sections are written EMPTY apart from `stack`. Do not fill them.

## 4. Interview her

Ask all four at once so she can answer in one go. Use her exact words in the
answers; do not polish them into your own register.

| Section | Ask |
|---|---|
| `special` (Why it feels special) | What did you feel the first time you used it? Name the moment, not the feature. |
| `trick` (The key trick) | Propose what you think holds it up, from the source, and ask her to correct it. |
| `alive` (Why so special) | What makes the motion feel alive rather than mechanical? |
| `steal` (Steal this) | Where would you use this idea in your own work? |

`what` you may draft from the page, but show it to her for confirmation in the
same message. `stack` you fill yourself.

Note the two labels sit awkwardly close: "Why it feels special" is the
experience, "Why so special" is the mechanism underneath it. Shina renamed the
second one and knows they are similar. Keep them distinct when asking.

## 5. Write the answers back

```bash
node field-note-new.js --fill <slug> \
  --special "..." --trick "..." --alive "..." --steal "..." --what "..."
```

## 6. Verify

- `/field-notes` lists the card with the thumbnail and the creator's name
- `/field-notes/<slug>` renders every filled section
- check 375px as well as desktop
- **no em dashes anywhere.** The script warns and so does the indexer, but
  check the rendered page too. This section bans them even though the rest of
  the site uses them.

## House rules for this section

- **Credit is structural.** Creator name and link on the card, at the top of
  the entry, and in the closing Credit block. An entry without a creator is
  not publishable.
- Adding a note is one file in `public/field-notes-data/`. The index is
  generated; never edit `index.json`.
- The slug is the filename, not the `slug` field. Copying a note file and
  forgetting to rename it is the mistake this guards against.
- Nothing is live until it is committed and deployed, roughly ninety seconds
  of Vercel build after the push.
