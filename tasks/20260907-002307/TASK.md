# Replay the CLI's error output, not only its results

- STATUS: OPEN
- PRIORITY: 100
- TAGS: tql,infra

The 34 differential invocations compare which tasks a *valid* query returns.
Nothing compares what an invalid one prints — and five divergences were found
there by hand in one sitting: the wording of a missing primary, of an
unrecognised one, of two primaries meeting, `Expected \`]\`.` losing its full
stop, `empty tag` losing its lowercase, and a caret drawn as a run instead of
the single `^` the C prints.

Every one of those was invisible to the suite. Add a fixture of invalid queries
with the binary's complete stderr — the help block, the source, the caret line,
the message — and compare `formatDiagnostic` against it byte for byte.

Cases the fixture should hold, being the ones that hit distinct branches:

    :               empty tag
    (empty)         primary missing at the end
    priority and    primary missing after an operator
    priority lt     same, after a comparison
    nope            unrecognised primary
    ]               unrecognised primary, bracket
    [               primary missing inside a group
    [:bug           unclosed group
    :bug not :ui    two primaries meeting
    :bug]           same, with a bracket
    5               ill-typed: integer where a boolean belongs
    :bug and 5      same, on the right of an operator
    .bug            deprecated spelling, which warns rather than fails

Two things the comparison has to allow for, both deliberate and both documented
where they are done: the `ERROR: ` prefix is dropped, and the primary list gains
the `~` lines that come with 20260906-235936.

Regenerating means running each case through the checkout at `../tatr` and
capturing stderr, so it is a manual step like the other two fixtures.
