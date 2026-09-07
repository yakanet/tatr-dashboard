# Fold the title filter into the query language, as a `~` term

- STATUS: OPEN
- PRIORITY: 80
- TAGS: tql,ui

Two boxes is one too many. Replace the separate `filter titles` field with a
term in the query itself, so `~windows and :bug` reads as one thought:

    primary ::= ':' tag | '~' word | '~' '"' words '"' | '[' expr ']'
              | 'not' primary | 'any' | 'tagged' | 'priority' | number

`~` rather than a bare quoted string, because a match on the title is loose —
every word, in any order, case ignored — and quotes promise a phrase everywhere
else, so `"windows support"` finding "Support for Windows" would surprise the
reader. With `~` carrying that meaning, quotes are left doing the one honest job
of grouping words that contain spaces. It also leaves `="..."` free should an
exact phrase ever be wanted.

A bare word was the other candidate and is worse: it is shortest to type and it
destroys the diagnostics, since `nto :bug` would quietly search for "nto"
instead of reporting `Unknown token`.

`~` conflicts with nothing in the grammar. A term evaluates to a boolean, so it
composes with `and`, `or` and `not` for free, and `priority eq ~x` fails as a
type error like any other. `TqlTask` gains `title` alongside `tags` and
`priority`. The matching itself already exists as `matchesTitle`.

**This is a deliberate divergence from the C implementation, and the first one.**
It is one-directional: every query the CLI accepts keeps working here, but a
query written here with `~` will not run there. That trade has to be written
down where the other decisions live, and the README's claim that a query copied
out of a shell behaves identically needs the qualifier — it stays true one way
round only.

What to settle while building it:

- **An unterminated `~"` is the normal state while typing.** It has to parse
  into a diagnostic with a span, exactly as `priority lt` does, not an
  exception.
- **The `text=` URL parameter goes away.** Nothing published uses it yet, so now
  is the cheap moment.
- **Completion after `~`.** It should offer nothing, or words drawn from the
  titles — but never tags, which cannot appear there.

The differential tests are the safety rail: 34 query invocations replayed from
the real binary must still pass unchanged, since adding a primary may not alter
any query the CLI can express.
