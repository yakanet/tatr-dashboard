# The keyboard panel does not hold the focus

- STATUS: OPEN
- PRIORITY: 70
- TAGS: ui

`Shortcuts.rows()` queries the whole document, so while the keyboard panel is
open `j`/`k` walk the rows behind it — moving the focus out of a dialog that
declares `aria-modal="true"`.

Either the panel traps the focus, or the shortcut layer stops navigating while
something modal is open. The second is less code and reads better: the layer
already knows when the panel is up, since it is what opened it.

Same area as 20260907-011001, and the two are best done together.
