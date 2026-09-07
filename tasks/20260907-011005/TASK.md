# `j` restarts from the top when the focus sits beside a row

- STATUS: OPEN
- PRIORITY: 60
- TAGS: ui

`current()` locates the focus with `item === active || item.contains(active)`.
The tag buttons in a list row are siblings of the marked link, not descendants,
so tabbing to a tag and then pressing `j` jumps to the first row instead of the
next one.

Walk up from the focused element to the nearest `[data-key-row]` instead —
`active.closest('[data-key-row]')` — and fall back to the containment test for
anything that is inside a row without being one.
