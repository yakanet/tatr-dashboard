# The keyboard does nothing on the homepage

- STATUS: OPEN
- PRIORITY: 50
- TAGS: ui

`Shortcuts` is mounted in `[...repo]/+layout.svelte`, so the only page without
keyboard support is the one a reader arrives on. `?` does not answer there, and
the repository cards carry no `data-key-row`, so `j`/`k` have nothing to walk.

Less a bug than a scope line drawn without saying so, which is why it is
recorded rather than left to be rediscovered. Moving the mount to the root
layout would cover both, and the actions it dispatches — switch view, focus the
query — have no meaning outside a repository, so the homepage wants a smaller
set: `j`/`k`, Enter and `?`.
