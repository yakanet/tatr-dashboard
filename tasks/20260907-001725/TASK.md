# Move the query language into src/lib/tql/

- STATUS: OPEN
- PRIORITY: 60
- TAGS: tql,infra

`src/lib/tatr/` holds the format — `huid.ts`, `task-md.ts`, `task.ts`,
`tags-file.ts`, `stats.ts`, `graph.ts` — each beside its spec. The query
language does not follow that shape: `tql.ts`, `tql-complete.ts`,
`tql.spec.ts`, `tql-complete.spec.ts` and `tql.conformance.spec.ts` sit loose at
the top of `src/lib/`, named by prefix instead of by folder.

Give it `src/lib/tql/` alongside `src/lib/tatr/`, and the prefixes stop earning
their keep:

    tql.ts                    ->  tql/index.ts  (or tql/query.ts)
    tql-complete.ts           ->  tql/complete.ts
    tql.spec.ts               ->  tql/query.spec.ts
    tql-complete.spec.ts      ->  tql/complete.spec.ts
    tql.conformance.spec.ts   ->  tql/conformance.spec.ts

Two things to keep an eye on. Imports are `#lib/...` with mandatory file
extensions under this SvelteKit generation, so every caller has to be updated by
hand and `pnpm run check` is what proves none was missed. And the fixture paths
in the conformance spec are relative — `../../../tests/fixtures/...` gains a
level.

Worth doing when nothing else is open in those files: it is a rename with no
behaviour attached, so it is cheap to do and annoying to do twice.
