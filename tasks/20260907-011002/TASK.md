# Completion offers tags inside a `~"..."` search

- STATUS: OPEN
- PRIORITY: 100
- TAGS: tql,ui

Typing `~"windows bu` offers `:bug`, and accepting it produces
`~"windows :bug ` — a query that does not parse.

`complete` guards against this with `if (token[0] === '~') return null`, and the
guard cannot see the sigil: `tokenAt` stops at whitespace, so the token under
the caret is `bu` and the `~"` two words back is invisible to it.

The test that should have caught it passed for the wrong reason. It asserted
`complete('~"windows su', 12, TAGS)` was null, which it was — because `su`
matched no tag, not because the guard fired. An assertion that passes for an
unverified reason proves nothing, and this one sat exactly where a real test was
needed.

Fix by looking at the text before the caret rather than at the token alone: an
odd number of quotes means the caret is inside a phrase. Test it with a prefix
that *does* match a tag, which is the whole point.
