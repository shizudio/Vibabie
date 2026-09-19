SOLMI — AI MUSIC VIDEO GENERATOR
Redesign handoff · Shizudio · 20 September 2026

────────────────────────────────────────────────────────────────────────
START HERE

  1.  solmi-ux-rationale.html
      What changed against the page live at
      solmi.ai/ai-music-video-generator, and why. Thirteen changes, each
      one as before / after / reason. Read this first — it explains the
      thinking the prototype only shows.

  2.  solmi-music-video-studio.html
      The redesigned page. Working prototype, not a picture.
      Try in this order:
        · click a TRY chip above the prompt box
        · click a track on the shelf, and the square + beside it
        · open "More options" and watch that nothing below it moves
        · hover the green button to see the sweep
        · toggle Sign in — the second half of the design is behind it

  3.  solmi-design-system.html
      Tokens, components, product patterns and ten standing rules, for
      building the rest of the pages in this language. Every swatch and
      button on that page is the live CSS, so you can inspect any element
      to read its real values, or copy the token block at the foot.

────────────────────────────────────────────────────────────────────────
OPENING THEM

Double-click any file. No server, no build, no install.

They do need an internet connection: fonts load from Google Fonts and
the clips and thumbnails stream from media.solmi.ai. Nothing else is
external, and nothing is tracked.

Chrome, Safari, Firefox and Edge, current versions. Both dark and light
themes work — the design system and the rationale have a toggle in the
top-right corner.

────────────────────────────────────────────────────────────────────────
WHAT IS REAL AND WHAT IS NOT

Real        Every control, the prompt, the track shelf, the settings row,
            the theme, the rail, the recipe player, the cost line.

Mocked      Sign-in is a front-end toggle standing in for a session.
            The three render rows are fixed — they show the shape of job
            state, not a backend.
            The Edit button points at /studio/edit/<job>, a placeholder
            route to swap for the real editor.
            Credit and render-time figures are plausible placeholders
            driven by one lookup table.

The open items are listed at the end of the rationale document.

────────────────────────────────────────────────────────────────────────
Questions: Shina · Shizudio
