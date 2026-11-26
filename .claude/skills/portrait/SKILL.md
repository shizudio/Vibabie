---
name: portrait
description: Change the profile picture on shizudio.me's About landing, and keep the old one in the archive. Use when Shina sends a photo and says it is her new profile picture, portrait, or landing image, or asks to swap or update it. Also covers questions about the portrait archive that visitors see when they click the picture.
---

# New profile picture

The portrait on the About landing comes from `public/portrait-manifest.json`,
newest first. Entry 0 is what the page shows. Everything behind it is the
archive a visitor sees when they click the picture, Telegram-style.

Nothing here is destructive: adding a picture pushes the previous one down a
place, it never replaces it.

## 1. Get the file onto disk

Shina usually drops the image into the chat. Those arrive in the session's
own directory and the tool result reports the path. Use that path directly;
there is no need to copy it into the repo first, the script does that.

If she sends a video as well (usually the Live Photo clip that sits next to a
photo), keep it: it plays on hover over the portrait. Photo and video often
arrive separately, which is what the attach command below is for.

## 2. Add it

```bash
node add-portrait.js <image> --alt "What is in the picture"
node add-portrait.js <url>   --alt "..."                   # a link works too
node add-portrait.js <image> --alt "..." --video <video>   # with a hover clip
node add-portrait.js --attach-video <video|url>            # clip arrives later
```

`--attach-video` puts a hover clip on a picture that is already in the archive.
It defaults to the current portrait; `--to <index|date>` picks another, and
`--force` replaces a clip the picture already has (it refuses otherwise).

A URL is the handoff that works with every agent. If you cannot write a
pasted image to disk, ask Shina to put it anywhere that serves a link and
give you that instead. The script fetches it, checks it is actually an image,
caps it at 25MB, and deletes its temp copy afterwards.

**The hover video is optional, and "no video" is a normal state.** A portrait
with no clip simply has no hover effect. Never reuse the previous portrait's
clip for a new photo: it is a video of a different picture. If Shina sends a
photo with no video, add it without one and say so; the script prints a note
and names the earlier clip if the previous portrait had one.

Videos are converted rather than copied: muted H.264 MP4, 720px wide at most,
faststart. A Live Photo `.mov` is often HEVC, which many browsers will not play.
This needs `ffmpeg`; without it only a ready-made `.mp4` or `.webm` is accepted.
Keep hover clips to a couple of seconds so they loop well and stay light.

The script optimises the image (max 1400px, WebP), files it under a dated
name in `public/About/portraits/`, and puts it at the front of the manifest.

**Always pass `--alt`.** It is what a screen reader reads, and the script
only warns when it is missing. Describe the picture, not the person's name:
"On the roof in Beijing at dusk" beats "Shina Foo".

`--date YYYY-MM-DD` if the photo is older than today and she wants the
archive dated truthfully. The date shows in the archive under each picture.

## 3. Check it

- the About landing shows the new picture
- clicking it opens the archive, with the new one first and marked Current
- the previous picture is still there, one step back
- 375px as well as desktop

The frame only becomes clickable at two or more pictures. With one, it is
correctly inert rather than opening an archive of itself.

## 4. Ship it

The site is static, so a new portrait is live only after a commit and a
deploy. About ninety seconds of Vercel build after the push. This was a
deliberate choice over a runtime blob store, which would have put the
archive outside git.

Follow the branch flow in CLAUDE.md: staging first, main only when asked.

## Notes

- The page shows the right portrait from the very first paint because
  `vite-plugin-portrait.js` writes entry 0 into the HTML at build time. Before
  that existed the markup carried the ORIGINAL portrait and a script swapped in
  the latest after fetching the manifest, so every visit flashed the previous
  picture first. If you ever see that flash again, the plugin is not running:
  check it is registered in `vite.config.js`.
- That also means a portrait change needs a rebuild to appear, not just the
  manifest being on the server. A deploy does that; a bare file copy to the
  server would not.
- `About/portrait.jpg` at the repo root is the original portrait. It is now only
  the fallback the plugin leaves in place if the manifest cannot be read, so
  keep it.
- Never edit `portrait-manifest.json` by hand to add an entry. The script
  keeps the naming, the optimisation and the ordering consistent; hand edits
  drift.
- Removing a picture from the archive IS a hand edit: delete its object from
  the manifest and its files from `public/About/portraits/`. Ask before
  removing anything, since the archive is the history.
