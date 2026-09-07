# Bring the homepage up to its mockup

- STATUS: OPEN
- PRIORITY: 90
- TAGS: scope,ui

The homepage is the one screen still built from nothing but a heading, an input
and a link. The mockup has more, and each piece of it earns its place:

- **The mark.** A small logo beside the wordmark, which every other view then
  inherits in the header. There is a `favicon.svg` already; the header shows
  bare text.
- **A search glyph in the field**, and the accepted forms said out loud beneath
  it: `owner/name`, a full URL, an SSH remote, `owner/name@branch`. The parser
  takes all four and nothing on screen admits it.
- **A card per repository under "TRY IT ON"**, with what it holds — "64 tasks,
  23 still open" — rather than a bare link.
- **The line that sells the URL scheme**: every repository gets its own address,
  shown as `/tsoding/tatr?q=:bug`.

Where the cards come from is the interesting part. List the repositories already
in the cache, newest first, since a reader who has opened three is far more
likely to want a fourth visit than a first one — and the counts are already
stored, so a card costs no request at all. With an empty cache, fall back to
`tsoding/tatr`, which is the reference implementation and the one repository
certain to be worth showing.

That needs a way to enumerate the store, which `RepoStore` does not have today:
it can `read` and `write` a key and nothing else. IndexedDB can list keys, and
the in-memory store used by the tests will need the same method.
