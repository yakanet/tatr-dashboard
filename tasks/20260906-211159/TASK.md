# Read a repository without burning the API rate limit

- STATUS: OPEN
- PRIORITY: 110
- TAGS: data

Measured on 2026-09-06:

- `codeload.github.com` refuses CORS, so downloading an archive is impossible
  from the browser.
- `api.github.com` allows CORS but is capped at 60 requests per hour per IP.
- `raw.githubusercontent.com` allows CORS and is not counted against that cap.

So: one API call to `git/trees/{branch}?recursive=1` for the whole tree, then
parallel raw fetches for the TASK.md blobs. On tsoding/tatr that is 30 KB total
for 64 tasks.

Cache the tree by ETag in localStorage; a 304 costs no quota. Fall back to
jsDelivr when the budget is spent — it can both list and serve, though its cache
lagged by one task when measured.
