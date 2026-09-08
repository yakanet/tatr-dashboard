# Say what is MIT here and what is not

- STATUS: CLOSED
- PRIORITY: 50
- TAGS: infra

The reference implementation is under the GPL, version 2, and this repository
declares MIT. The question is whether that is allowed when no line of tatr's C
is used — and it is, but not for the whole tree, which is what took the reading.

**The viewer itself is MIT and defensible.** Copyright protects expression, not
ideas, formats or behaviours: `tasks/<huid>/TASK.md` with its `- KEY: value`
lines, the query grammar, the sort order — those are specifications. Writing an
independent implementation of them in another language is interoperability, and
the copyleft of the GPL attaches to derivative works of the covered code, of
which there is none here.

**The fixtures are the exception, and they are not ours to relicense.**
`tests/fixtures/tsoding-tatr-raw.json` holds the complete text of 64 `TASK.md`
files from the reference repository — 33 kB of somebody else's prose.
`tatr-ls-output.json` and `tsoding-tatr.json` carry their titles;
`tatr-query-errors.json` carries the diagnostics `src/query.c` prints. Ids,
statuses, priorities and tags, in the other two, are much closer to facts than
to expression.

So a `NOTICE` now states it: MIT everywhere, except those recordings, which are
GPL-2 and the work of tatr's authors, kept as test data because the suite
replays them field by field. The README says the same where it describes them,
and `LICENSE` was left untouched so the licence of the code stays machine
readable.

Two alternatives were weighed and refused. Regenerating the fixtures from this
repository's own tasks would make the tree purely MIT and cost the corpus that
catches what we would not have thought to write. Dropping only the raw bodies
would keep most of the value, but for a file that a notice covers just as well.

Left open, and worth a decision rather than a silence: `huid.ts` says
`chopHuid` is "a direct port of `chop_huid`", and its shape does follow the C
loops deliberately. A translation is a derivative work, so the strongest form
of the claim above — that nothing was translated — is not one this code can
make today. Fifteen lines rewritten from the behaviour would earn it. Two
diagnostics in `query.ts` are also copied verbatim from `src/query.c`; short
enough to be below the threshold of originality, but the `NOTICE` says where
they come from rather than claiming them.

Not legal advice, and it was not written by a lawyer. What it is: the facts
about which files carry whose work, written down where a reader will find them.
