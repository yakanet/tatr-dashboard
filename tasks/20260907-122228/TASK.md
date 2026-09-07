# Open a folder on this machine as a repository

- STATUS: OPEN
- PRIORITY: 60
- TAGS: data,ui

A reader points this viewer at a public repository, which means the one thing it
cannot show is the repository someone is actually working in: private, or simply
not pushed yet. This project has felt it on itself — the site could not show the
tasks in this very folder until they were pushed, the dev server reading from
GitHub like everything else.

The browser can read a directory the reader chooses.
`showDirectoryPicker()` returns a handle that traverses, is structured-clonable
so it can be kept in IndexedDB, and answers `isSameEntry` so the same folder is
recognised on a later visit — Chromium only. `<input type="file"
webkitdirectory>` works everywhere and is enough for a single reading, and
`webkitGetAsEntry` covers dropping a folder on the page. Nothing is uploaded and
the browser arbitrates the permission, which is the promise the README already
makes.

**This belongs before 20260906-211255, not after it.** A local folder is what
says what shape that interface should have, because it removes four things the
current contract assumes:

- **URLs.** The loader reads through `fetch(rawUrl(...))`. A folder has no URL,
  so the contract wants `read(path)` rather than a URL builder — with
  `assetUrl(path)` beside it, which a local source answers with a `blob:` made
  on demand for the images and attachments a body points at.
- **A budget.** No quota, no staleness, so refreshing is free and the
  `cached … · Refresh` line changes meaning: it should reread rather than warn.
- **A branch.** A working tree is whatever is checked out, so `HEAD` stops
  meaning anything — though `.git/HEAD` is a file like any other, so the branch
  can still be shown.
- **A shareable address.** This is the real tension: "every view is a link" does
  not survive. A local folder is a session, not an address. The URL can carry a
  marker, but the page has to ask for the folder again.

Implementing GitLab first would validate none of that, GitLab being
GitHub-shaped. So this task's findings are 20260906-211255's input.

---

Feasibility, measured rather than argued.

**The interface is universal; the door is not.** `FileSystemDirectoryHandle`
with `entries()`, `getFile()` and `file.text()` is what does the work, and it is
reached two ways with very different support — caniuse's own data, not a guess:

    File System Access (showDirectoryPicker)   Chrome/Edge yes, Firefox no, Safari no
    <input type="file" webkitdirectory>        everywhere

`navigator.storage.getDirectory()` is supported everywhere and is *not* this: it
is the origin's private sandbox, which cannot see a folder on the disk. It was
useful anyway — it hands back the same handle interface with no native dialog,
so the traversal could be exercised without a click.

**The two doors differ in exactly one way that matters.** The picker yields a
handle that survives IndexedDB (verified: stored, read back, `isSameEntry` true
for the same folder and false for another, `queryPermission` answering), so the
same folder is recognised on a later visit and a refresh is a genuine reread.
The input yields a flat `FileList` with `webkitRelativePath` and no handle: one
snapshot, and refreshing means picking again.

Which is a smaller difference here than it looks, because the cache already
works that way — read once, never expire, reread only when asked. So the
universal path is the one to build first, and the picker adds a real refresh
where it exists.

**Cost, on a tree this repository's size** (38 files, 59 kB, through OPFS so a
real disk will be slower): 7.1 ms to walk it and 3.6 ms to read all 31 task
files. The GitHub path costs one rate-limited API call plus 31 CDN reads. This
is not a performance question.

**`assetUrl` works.** A `blob:` URL made from a file handle loads in an `<img>`
(checked with a real 4×4 PNG), so images in a body and files in the Files panel
have an answer locally.

**The picker needs a gesture.** `showDirectoryPicker()` off a timer answers
`SecurityError: Must be handling a user gesture`, so it hangs off a real click —
which the homepage's form already is.

**`.git/HEAD` reads fine**, so the branch is still displayable: it is a file.

**And the code is readier than expected.** Outside the providers themselves,
only four places assume a URL:

    load.ts:154         the parallel read of task files
    load.ts:225         loadTaskDescription, for the detail view
    markdown.ts:55      resolveAttachment, for images and links in a body
    task/[id]:75        blobUrl, for the Source panel

The first three become `read(path)` and `assetUrl(path)`. The fourth has no
local equivalent at all — there is no page to link to — so the Source panel is
simply absent for a local folder, which is the first honest sign that a source
is not a forge.
