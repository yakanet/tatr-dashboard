# Open a folder on this machine as a repository

- STATUS: CLOSED
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

---

Built on the `local-folder` branch, and it reads a folder end to end: the
overview, the list, the board, the references and a task's own page, with the
query bar and the keyboard working as they do on a repository.

**One module reads the folder, two doors open it.** `fromFileList` takes what
the directory input hands over and recovers the paths from `webkitRelativePath`;
`fromDirectoryHandle` walks a handle. Both produce a name and a map of paths to
files, so nothing downstream knows which door was used. The map keeps only
`tasks/**` and `.git/HEAD` — a checkout holds a hundred thousand files that are
none of this viewer's business, and the reader picked the repository rather than
a subfolder of it.

**The loader gained a branch, not a rewrite.** Both sources arrive at the same
`assemble()` with the same pairs of path and text, which was extracted for it;
what differs is where the pairs came from. The four URL call sites the study
found came out as expected — reading is `readFile`, an attachment or an image is
a `blob:` from `assetUrl`, and the Source panel is simply absent, there being no
page on any forge to link to.

**Nothing is cached, deliberately.** The cache exists to protect an API budget
this source does not spend, and a stored copy of a folder someone is editing
would be wrong before it was written. A test pins that: reading twice re-reads,
and the store stays empty. Which also means the folder never appears in the
homepage's list of repositories already read — it is not one.

**A local reference is one URL segment.** `/local`, and the folder's name is
deliberately not in it: nobody else's machine could follow that address. The
name travels on the reading instead — `LoadResult.label`, which is not cached
because it is derived — and the header and every page title take it from there.
`local` is free as a segment because a repository on a forge needs an owner too,
so one segment can never be one.

**A reload is a dead end, and says so.** The browser takes the grant back, so
`/local` after a reload shows *No folder open* with the reason and the way out
rather than an error. Where the picker exists its handle is kept and Refresh
rereads the folder; where it does not, the button reads `Reopen…` and asks
again, because a `FileList` is a snapshot with no way back.

Verified in the browser by planting a folder through the module and walking
every view: the header names it, `.git/HEAD` gives the branch, a body's image
renders from a `blob:`, the Files panel lists the attachment with its size, the
reference between two tasks resolves, and a reload lands on the panel above.

**Found by using it, in Brave.** The directory input makes the browser ask
before handing anything over, and it asks by the file count: it cannot know the
page will not upload what it is given, so a whole checkout produces *"import
7,775 files?"* — of which this viewer keeps about forty. The filter runs after
the browser has already enumerated everything, so it cannot help with the
question.

What helps is accepting `tasks/` as the picked folder: the same question then
counts the tasks alone. A folder of task folders is recognised by the layout
itself — a `TASK.md` one level down and nothing under `tasks/` — and the paths
are put back before anything else sees them. It costs `.git/HEAD`, which is to
say the branch name, and the folder is then called `tasks` in the header. Both
are said on the homepage, alongside the fact that nothing is uploaded, because a
warning nobody expected reads as a warning about the site.

Brave also turned out to ship File System Access disabled, so it took the input
path and the header offered `Reopen…` — the fallback working as intended, and a
reminder that "Chromium" is not one browser.

**Two ways in, one at a time.** The homepage carries a tab list rather than a
stacked pair: each door needs a line of explanation, and stacked they read as
one crowded instruction rather than a choice. They wear the header's own
underline, one idiom for one meaning, and the arrow keys move between them,
which is what makes them tabs rather than two buttons.

The local panel then says what *this* browser is about to ask, which caught a
line that was wrong for half the readers: the picker asks for access to one
folder and never counts files, so the count warning belongs to the input alone.
A browser with neither door says so instead of offering a button that cannot
work. `folderAccess()` decides it once, and the panel only renders after a
click, so the prerendered HTML never carries an answer to correct.

Simplified before landing, and one of the three was a performance bug rather
than tidying: the walk descended everything and filtered afterwards, which on a
real repository means reading `node_modules` and every loose object under `.git`
to arrive at the same forty files. A handle can be asked for a path by name, so
`tasks/` is the only directory descended and `.git/HEAD` is fetched directly.
The skip list of build folders went with it — there is nothing left to skip.

That also narrowed `looksLikeTasksFolder` to the directory input, which is the
only door that has to read the shape out of flat paths.

And the name of a reading moved onto the state as `repo.name`, which had been
the same `$derived` line in five page scripts and a sixth in the header. The
state knows what it read and what it is reading; a view should not work it out
again.

---

Merged and in production, and used on three browsers by three different doors
before this was closed:

- **Brave** picked the whole checkout through the directory input, which is what
  produced the file-count dialog and, with it, the acceptance of a `tasks/`
  folder.
- **Firefox** read `tsoding/tatr` from the disk on the deployed site: 64 tasks,
  41 closed, the months chart with its five empty months — the reference
  repository shown without a single network request.
- **Chrome** exposes the picker, and that is the one path still never taken by a
  human hand: it needs a click, and every real use so far landed on the input.
  It is exercised by the tests and by the same walk the origin-private file
  system drove during the study, which is not the same as having been used.

Firefox picking `tasks/` also showed the cost of that shortcut plainly: the
header reads `tasks`, because `webkitRelativePath` starts at the folder that was
picked and the parent's name is not knowable from it. Honest, and unhelpful. The
repository name is simply not available on that path.

What was left undone is now recorded rather than carried here: dropping a folder
is 20260907-143334 and remembering one between visits is 20260907-150656 —
which, if it happens, is also what would let a local source answer 20260907-040703
about what moved.
