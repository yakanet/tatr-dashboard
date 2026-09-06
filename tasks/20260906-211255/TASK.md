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
