# Link a task id written in a body

- STATUS: OPEN
- PRIORITY: 60
- TAGS: ui

Task bodies cite each other by id — this repository's own do it constantly, and
so do upstream's — and every one of those ids renders as plain text. The
References panel lists them, so the information is on the page; what is missing
is that the id *in the sentence that explains it* is not clickable. The reader
has the reason in front of them and has to go around by the panel.

So: a HUID in a rendered body becomes a link to that task's page.

Four constraints, all of them found in the code rather than guessed:

- **`renderMarkdown` only, never `renderInline`.** The list and the board wrap a
  title in `<a href=… data-key-row>` and fill it with `renderInline`. An anchor
  inside that anchor is invalid, the browser breaks it apart, and the row link
  the keyboard depends on goes with it. Titles keep their ids as text.
- **Only ids this repository has.** Our own tasks cite upstream ones —
  20260304-115038 for instance — which do not exist here, and linking those
  would lead a reader to *No such task*. The References panel already lists only
  what resolves; the same rule keeps the two agreeing.
- **Not the task's own id.** A body naming itself would link to the page it is
  on.
- **Recognised by `scanHuids`, not by a regex written for the occasion.**
  `huid.ts` ports the reference implementation's own scan, and the References
  panel is built from it. A second, looser notion of what an id looks like would
  make a body link ids the panel does not list.

On the shape: markdown-it's own linkify works by splitting `text` tokens in a
core rule, which is the pattern to follow. Code spans are not text tokens, so
`` `20260906-211255` `` stays literal for free, but the inside of an existing
link has to be skipped explicitly or the nesting comes back by another door.

The href wants `resolve('/[...repo]/task/[id]')`, which is what carries the
`BASE_PATH` the deployed site is served under. That is a `$app/paths` import,
and `render/markdown.ts` is a plain module under unit test, so it should be
handed a builder in `RenderOptions` instead — the pages that call it already
have a `taskHref` for their own links.
