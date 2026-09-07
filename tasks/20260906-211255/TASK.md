# Support forges other than GitHub

- STATUS: OPEN
- PRIORITY: 50
- TAGS: data

The URL scheme already carries a host segment and `src/lib/sources/provider.ts`
is meant to abstract listing and reading. GitLab and Gitea both expose a tree
API and a raw endpoint, so the shape should transfer.

Not urgent — no one has asked, and GitHub covers the case that motivated the
project.

---

Extends the provider abstraction from 20260906-211159.

---

The shape to build first is an interface, with GitHub as its only
implementation for now. What the code already asks of it, once the
GitHub-specific parts are collected in one place:

- **An id.** `github`. It is already half-present as `Provider.name`, which the
  UI prints when it says which source answered.
- **The hosts it answers for.** `parseRepoPath` currently guesses — a leading
  segment containing a dot is a host — and falls back to `github.com`, then
  `assertGitHub` rejects everything else. A forge has to declare its hosts, and
  the list cannot be closed: a self-hosted Gitea or GitLab is on whatever domain
  its owner chose, so an unknown host has to be either named by the reader
  (`gitlab.example.com/owner/name` already parses) or probed.
- **Two URLs, and probably three.** Raw contents, the file's page on the forge
  (`blobUrl`, added in 20260907-040701), and the repository's own page — the
  header prints `owner/name` and links it nowhere.
- **A logo.** Inline SVG, bundled, taking its colour from the theme, exactly as
  `Mark` does: the page makes no request for an image, and that rule is not
  worth breaking for a forge badge.
- **Listing the tree**, which exists as `Provider.list`.

And what is not on the list above but will decide how much this costs:

- **`Provider` is not a forge.** All three of today's providers are GitHub —
  its API, ungh proxying it, jsDelivr serving a cached copy of it — and each one
  calls `assertGitHub`. So a forge *owns* an ordered list of listers with their
  fallback order, and a new forge starts with exactly one and no fallback. Which
  means `mayBeStale` and the "which source answered" line have to still read
  sensibly when there is nothing to fall back to.
- **`RepoRef` is GitHub-shaped, and an interface does not fix that.** GitLab
  nests groups arbitrarily deep, so `group/subgroup/project` is a repository
  path; `RepoRef` has a fixed `owner` and `name`, `SEGMENT` forbids a slash in
  either, and `parseRepoPath` requires exactly two segments. The ref needs to
  carry a path rather than a pair, which touches `repoKey`, the cache, and every
  URL builder. This is the real work in this task.
- **What reference to use when none is given.** `HEAD` is deliberate here and
  was measured: both the trees API and raw accept it, which halves what listing
  costs against resolving the default branch first. That is a fact about GitHub.
  A forge has to say what its own "no branch given" reference is, and whether
  finding it costs a request.
- **How this forge says the budget is spent.** GitHub answers 403 with
  `x-ratelimit-remaining: 0`, or 429. `ProviderFailure` is the shared vocabulary
  and stays; the translation into it is per-forge. `truncated` belongs here too:
  GitHub's tree API caps a listing, which is *incomplete* rather than *stale* —
  two different things the UI currently conflates into one sentence.
- **Whether contents are free and CORS-open.** The whole architecture rests on
  the split in 20260906-211159: listing is metered, contents are not, so the
  loader reads 12 files at a time without asking anyone's permission. A forge
  whose raw endpoint is metered or refuses CORS collapses that split, and its
  implementation would have to say so rather than quietly making every task
  cost quota.
- **No credentials.** A token would raise every limit and is the obvious next
  thought; it is out of scope here and belongs to nothing yet. This site has no
  server and stores nothing it would not show a stranger.

Two things already work and should not be rebuilt: the cache key carries the
host (`github.com/owner/name@branch`), so two forges coexist in storage
untouched, and `[...repo]` is a catch-all route, so a deeper path is a parsing
problem rather than a routing one.

Worth deciding while writing it: the differential fixtures replay one GitHub
repository, and the conformance tests must stay about the *format* rather than
about a forge, or a second implementation will have nothing to be tested
against.
