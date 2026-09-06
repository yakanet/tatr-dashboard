# Test the views, not only the libraries

- STATUS: OPEN
- PRIORITY: 100
- TAGS: infra,ui

Every library is covered — two of the suites replay the compiled binary over the
64 tasks of tsoding/tatr — and not one test renders a component. The gap is
already anticipated in `vite.config.ts`, which excludes
`src/**/*.svelte.spec.ts` from the `server` project for a client project that
was never added.

What that costs is measured rather than theoretical. Three defects in the
dashboard and graph work were caught by a reader looking at the screen, never by
the suite: a stacked column rounded on the wrong end, a chart click landing on
closed tasks because the bars counted all of them, and arrowheads stopping short
of the node they point at.

Add the browser project and cover what a glance cannot assert on its own:

- a chart's click target carries the query the bar counted, and no more;
- one head per direction, two for a reciprocal citation;
- every failure state renders its own message, including `no-tasks-folder`,
  which needs a repository nobody wants to fetch in a test.

Worth taking before 20260906-211227 adds a fourth view: each view shipped
without a test widens the surface only a human can check.
