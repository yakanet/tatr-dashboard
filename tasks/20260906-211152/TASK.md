# Parse the tatr format faithfully

- STATUS: OPEN
- PRIORITY: 110
- TAGS: scope,format

The parser must reproduce `src/md.c`, not the README, which simplifies.

- The title line must start with `#`. If it does not, the reference parser
  abandons property parsing entirely and emits an error title. Reproduce that.
- Properties are consecutive `- KEY: value` lines where KEY is alphanumeric
  only. They land in a hash table, so arbitrary keys are legal and should be
  displayed, not just STATUS/PRIORITY/TAGS.
- Tags are separated by commas and/or whitespace, interchangeably.
- Anything that is not exactly `CLOSED` counts as open.
- A higher PRIORITY number is more urgent. The README's `priority lt 50`
  example reads the other way round; it is wrong.

Trap worth a test: `- TAGS:` with an empty value exists in real repositories.
A `\s*` after the colon swallows the newline and captures the first line of the
description as the tag list. The separator must be `[ \t]*`.
