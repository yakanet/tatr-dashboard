# Audit the code for complexity, gaps and simplifications

- STATUS: OPEN
- PRIORITY: 60
- TAGS: infra,ui,scope

Asked because the code felt like too much of it. Four read-only reviews ran over
the views, the source layer, the domain libraries and the test suite; every claim
below was re-verified against the code before being acted on, and one was thrown
out for not holding.

**The impression was right and the place was wrong.** Of 3,846 lines in
`routes/` and `components/`, 1,806 — 47% — were scoped CSS, and no selector was
dead: the weight was re-declaration. Six idioms existed in three or four copies,
which is how a panel came to have three paddings and a `.mono` class came to be
applied in five places while being defined in two. Elsewhere the test/production
ratio is about 1.0; for the views it is 0.

Six defects came out of it, all confirmed:

- **A folder without a `tasks/` subfolder makes the walk descend everything**
  under a synthetic prefix, so `NoTasksFolderError` never fires and the reader
  waits, then reads "0 tasks". The directory-input door checks; the other two
  do not.
- **`.mono` was a phantom**: five elements rendered in the body face, and the
  list and the board disagreed on screen about the same data.
- **The cache's memory fallback was rebuilt per call**, so with IndexedDB
  unavailable nothing was ever cached and the homepage list stayed empty.
- **The `AbortSignal` never reaches a local folder**, so leaving a page does not
  stop its reads.
- **`"#lib"` in `package.json` maps to a file that does not exist.**
- **The list explained the wrong tag**: `describe` took a task and read
  `tags[0]` while being called per tag.
- **"Reading the body…" could stick**, the early return never resetting it.

And one claim that did not survive checking: the board does *not* lose the
`closed` parameter. Its `syncUrl` starts from `page.url`, so it only ever
touches `q` and an existing `closed=1` rides along.

---

Stage one done: the shared idioms, the two display defects, and what was
verifiably dead.

`src/styles/` now holds what every view agreed on and none owned — tokens, the
base elements, one panel, one action button, the labels (`.mono`, `.tag`,
`.prio`, a title's inline code, an empty note) and the keyboard's marks — and
`app.css` is the index that imports them. What stays in a component is what only
that view knows: a density, a column width, a layout. 1,806 lines of view CSS
became 1,675, and six idioms have one definition each.

SCSS was considered and declined. Custom properties already do what its
variables would, and better — three theme blocks swap live, which compile-time
variables cannot. Native nesting was measured rather than assumed: a probe
component using `&` type-checks and survives the production build in this exact
toolchain. Mixins are the one real gain, and would keep Svelte's scoping while
duplicating the declarations in the bundle; for six idioms shared *by intention*
the shared name is the point. The cost would have been `sass-embedded` plus a
preprocess step, in a project with one runtime dependency.

Removed as dead, each verified by counting readers: `--prio-1` to `--prio-4` and
`--accent-weak`, declared in all three theme blocks and used nowhere;
`RepositoryState.closed`; an `eslint-disable` directive in a project with no
eslint configuration.

---

A regression of my own, found by the reader rather than by the audit: the
dashboard never arrived, the page staying on its two-step loading panel for
ever, with no network request made at all.

`load()` captured `this.previous` unconditionally, and `load()` is called from
the layout's `$effect`. Reading state there makes the effect depend on it —
and the same method writes it a few lines down. So the effect re-ran, its
cleanup aborted the reading in flight, a new one started, wrote the value
again, and around. The phase never left `listing`.

It only showed where a cache entry carried a comparison: with `previous` already
null, writing null changed nothing and the effect did not re-run. Which is why
a fresh origin looked healthy and the reader's did not — and a good reminder
that "works on my machine" here meant "my IndexedDB is empty".

Both reads are behind `refresh` now, so the path an effect takes touches
neither. No cheap test covers it: the fault is a reactivity property, not a
value, and pinning it needs an `$effect.root` test — which is the exact payoff
of opening the view-test slot, since a spec file for one cannot run today.
