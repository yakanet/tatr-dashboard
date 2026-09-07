# Keep the forge's knowledge inside the forge

- STATUS: CLOSED
- PRIORITY: 40
- TAGS: data

Found by reading rather than by a failure, while asking why `blobUrl` and
`PROVIDERS` live in `github.ts`. They belong there — all three listers *are*
GitHub, so the fallback chain is the forge's and the URL builders are its
shapes. But the question found one thing sitting in the wrong file and two
smaller ones beside it.

`assertGitHub` was exported from `provider.ts`, which is the vocabulary the
listers share: a GitHub fact in the neutral module. It could not simply move,
either — `ungh.ts` and `jsdelivr.ts` both called it, and `github.ts` imports
them for `PROVIDERS`, so importing it from there would have made a cycle.

The way out was to notice the guard has no business being per-lister. All three
read the same forge, so the host is asked once, at the entrance of the chain in
`listRepository`. Three calls become one, the shared export goes away, and the
error now names the forge that refused instead of whichever lister happened to
be asked last.

Two more, while the file was open:

- **`rawUrl` and `blobUrl` were exported for their own test only.** Nothing else
  imported them. The spec now goes through `githubKind.open(…)`, which is how
  the application reaches them, so the module's surface is the contract and
  `listRepository`.
- **`defaultBranch` was dead.** Exported, called by nobody, and contradicting a
  decision this project made deliberately: `HEAD` is the reference precisely so
  that resolving a default branch by name never costs a request. A function
  offering to do it was an invitation to undo that.

Nothing was covered here before: no test asserted that an unknown host is
refused, which is the behaviour that answers `gitlab.com` today. One now does,
and it also pins that no lister is tried — proved by removing the guard, which
fails it.

577 tests green, `svelte-check` at zero.
