# List view and task detail

- STATUS: OPEN
- PRIORITY: 100
- TAGS: ui

Dense sortable table, sorted by priority descending as `tatr ls` does, with
closed tasks hidden by default to match the CLI.

Detail opens through shallow routing (`goto(url, { shallow: true })`, new in
SvelteKit 3) so the list stays behind it. Markdown must be sanitised — it comes
from an arbitrary third-party repository, so rendering it raw is XSS by
construction. Rewrite relative attachment links to raw.githubusercontent.com.

---

Needs the routing from 20260906-211206.
