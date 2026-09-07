# Drop a folder on the page to open it

- STATUS: OPEN
- PRIORITY: 50
- TAGS: ui,data

Possible, and it may be the best door of the three rather than a third
convenience. Two APIs carry it, and the support numbers are the argument:

    DataTransferItem.getAsFileSystemHandle   Chrome 86, Firefox no, Safari no
    DataTransferItem.webkitGetAsEntry        Chrome 13, Firefox 50, Safari 11.1

Both were checked present in Chrome; the versions are MDN's compatibility data
rather than a guess.

**On Chromium it is nearly free.** `getAsFileSystemHandle()` returns a
`FileSystemDirectoryHandle` — exactly what `fromDirectoryHandle` already walks,
from 20260907-122228 — so a dropped folder arrives as the *good* kind of source,
with a handle, which means Refresh rereads it. No new reading code at all.

**Everywhere else it still works**, through `webkitGetAsEntry()` and the legacy
entry tree. That needs a walker of its own, and it holds the trap that API is
known for: `createReader().readEntries()` is callback-based and returns a page
at a time, so it has to be called again until it answers with an empty array —
reading it once looks like it worked and silently loses the rest. Like the
directory input, it yields no handle, so such a folder is a snapshot.

**And it may avoid the question the input asks.** A drop is itself the gesture,
so there should be no *"import 7,775 files?"* count dialog — the thing that made
20260907-122228 accept a picked `tasks/` folder in the first place. Worth
confirming before it is claimed on screen: if it holds, dropping becomes the
path to recommend for a browser without the picker.

Where: the homepage's local panel is the obvious target, and the *No folder
open* panel is the second, since that is where a reader lands after a reload.

One trap to write down before it is met: `event.dataTransfer.items` is emptied
when the drop event's turn ends, so the handles or entries have to be collected
synchronously in the handler and only then awaited. Doing the natural thing —
awaiting the first one, then reading the list — finds an empty list.

Also worth handling out loud: something that is not a folder. A dropped file has
no tree to read, and saying so beats doing nothing.
