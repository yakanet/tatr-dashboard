# List a task's other files as attachments

- STATUS: OPEN
- PRIORITY: 90
- TAGS: ui,data

A task folder may hold more than its `TASK.md`. On tsoding/tatr seven files do:
four screenshots, `nob.h`, `path.c` and a `.gitignore`, with `20260321-181305`
carrying four of them on its own. Show them on the task, so what a task carries
is visible without reading for it.

The listing already knows. `load.ts` keeps only entries matching
`tasks/<id>/TASK.md` and drops the rest, though the whole tree was downloaded in
the same request — so this costs **no extra request at all**, only the entries we
are currently throwing away. `TreeEntry` even carries `size`, so a file can be
listed with its weight without fetching it.

Six of those seven files are already referenced from their `TASK.md`, and
rendering handles them: `link_open` and `image` both rewrite a relative path to
the repository's raw CDN, so a referenced screenshot displays and a referenced
`path.c` is a working link. The gap is narrower than it looks — an unreferenced
file is invisible — but a list is worth having even for referenced ones: it says
what a task carries without reading a long body to find out.

To decide when building it:

- **What to hide.** The only unreferenced file upstream is a `.gitignore`, which
  is tooling rather than an attachment. Dotfiles are the obvious cut; anything
  more is guessing.
- **What the cache keeps.** Only metadata is stored, so the file names have to
  join it. Seven names for a 64-task repository is nothing, but the shape should
  hold for a repository where every task carries a screenshot.
- **Whether to mark the referenced ones**, so the list does not read as a
  duplicate of what is already shown in the body.

Attachment paths must go through `resolveAttachment`, which refuses a path
climbing out of `tasks/` and pins the host — see 20260906-211220 for why that
rule exists.
