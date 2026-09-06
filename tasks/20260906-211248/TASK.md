# Self-host the webfonts

- STATUS: OPEN
- PRIORITY: 70
- TAGS: infra

IBM Plex Sans/Mono and Bricolage Grotesque currently load from Google Fonts,
which adds a third-party request and a render dependency on someone else's CDN.

Self-host via fontsource, subset to latin, and preload the display face.
