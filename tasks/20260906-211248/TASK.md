# Self-host the webfonts

- STATUS: OPEN
- PRIORITY: 70
- TAGS: infra

IBM Plex Sans/Mono and Bricolage Grotesque currently load from Google Fonts,
which adds a third-party request and a render dependency on someone else's CDN.

Self-host via fontsource, subset to latin, and preload the display face.

---

The packages exist, all three, at fontsource 5.3.0 — with four findings that
change the plan above.

    @fontsource-variable/ibm-plex-sans          45.7 kB  wght 100-700, one file
    @fontsource-variable/bricolage-grotesque    41.3 kB  wght 200-800
    @fontsource/ibm-plex-mono                   14.7 + 14.9 + 15.6 kB

Sizes are the latin woff2 only, read out of the tarballs rather than guessed.

**There is no variable Plex Mono.** `@fontsource-variable/ibm-plex-mono` does
not exist; IBM ships no weight axis for it. So three static files, and 600 is
worth checking before it is shipped — 15 kB for a weight that may appear
nowhere.

**The variable packages rename the family.** Their faces declare
`'IBM Plex Sans Variable'` and `'Bricolage Grotesque Variable'`, so
`--font-sans` and `--font-display` have to name those. Get it wrong and nothing
errors: the stack simply falls through to `system-ui`.

**The variable packages have no per-subset CSS.** The static one offers
`latin-400.css`; the variable ones expose only `wght.css`, `opsz.css` and
`index.css`, each declaring all seven subsets. `unicode-range` keeps the reader
from downloading cyrillic, but the build ships it. Three `@font-face` rules
written by hand in `app.css`, pointing at the latin files of the installed
packages, gives the same result with the files we asked for and nothing else —
and puts `font-display` and the display face's `preload` where they can be read.

**Bricolage has an `opsz` axis that is in use without being asked for.** The
Google URL requests `opsz,wght@12..96`, and `font-optical-sizing` defaults to
`auto`, so the browser is already driving the optical axis from the rendered
size — the homepage's headings, at 28-38px, are not drawn as they would be at
14px. The `wght`-only file is 41.3 kB, the one carrying `opsz` is 76.9 kB, and
the full standard file 131.5 kB. Dropping the axis changes the headings; the two
go side by side on screen before that is decided, not by argument.

Bytes on the wire are roughly unchanged either way: Google already serves latin
subsets of comparable size. What self-hosting buys is two fewer third-party
connections and no render dependency on a CDN we do not control; what it costs
is about 130 kB in the repository and in the build.
