# Say what changed since the reader's last visit

- STATUS: OPEN
- PRIORITY: 55
- TAGS: data,ui

A refresh replaces the cached snapshot and says nothing about what moved. The
snapshot it overwrites holds every id with its status, priority and tags — which
is exactly what is needed to answer the question a reader actually has on
arriving: *what happened since I last looked?*

Keep the previous snapshot alongside the new one and compare:

    3 closed, 1 opened, 2 repriorised since your read of 6 September

with those rows marked in the list, and the marks clearing once acknowledged.

No request is added: both states are already local. It turns the cache from a
constraint into the feature — the cache never expiring on its own is a decision
about the reader's rate limit, taken in 20260906-211159, and this is what that
decision buys back.

The CLI cannot do this at all. It reads a folder as it stands and holds no
memory of how it stood before, so a comparison is not an addition to anything it
expresses: nothing to diverge from.

Two things to settle while doing it: the cache is metadata only, so a title
change is invisible and a description change doubly so — the comparison must
claim only what it can see. And a repository read for the first time has nothing
to compare against, which is the common case for a link someone was sent, so the
whole panel has to be absent rather than empty.
