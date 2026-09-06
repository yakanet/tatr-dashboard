# Repository routing and its load states

- STATUS: OPEN
- PRIORITY: 100
- TAGS: ui

One unique URL per repository: `/{owner}/{name}`, with an optional forge host
prefix and an `@branch` suffix. Already implemented and tested in
`src/lib/repo/ref.ts`.

What is left is the loading, empty and error states: progressive loading (the
tree arrives before the files), rate-limit exhausted, no `tasks/` folder, and
unparsable task files listed rather than dropped.
