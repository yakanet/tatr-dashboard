# Board with columns built from tags

- STATUS: OPEN
- PRIORITY: 90
- TAGS: scope,ui

Columns come from tags rather than status, since status has only two values.
The `scope` tag means "currently working on" upstream, which makes a real
in-progress column: Backlog (open, no `:scope`), In progress (`:scope`), Done
(closed).

This matches the conclusion of upstream task 20260826-200847: "Maybe if the
people want to kanban this entire thing they should just use tags for that?"

Read-only, so cards cannot be dragged.

---

Reuses the row and detail work from 20260906-211220.
