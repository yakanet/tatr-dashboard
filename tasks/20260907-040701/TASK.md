# Link a task to its file in the repository it came from

- STATUS: OPEN
- PRIORITY: 65
- TAGS: ui

Nothing on a task's page says where the file lives. A reader who wants the raw
markdown, the blame, or the commit that closed it has to reconstruct the URL by
hand from the owner, the name, the branch and the id.

    https://github.com/<owner>/<name>/blob/HEAD/tasks/<id>/TASK.md

All four parts are already in `RepoRef`, and the loader knows which provider the
files came from, so the link costs a template and nothing else.

This is deliberately the answer to wanting a task's history rather than reading
it ourselves. The format carries no modification date — upstream task
20260304-115038 is about exactly that absence — and the API route to it is
`/commits?path=tasks/<id>/TASK.md`, one request per task against an
unauthenticated budget of sixty an hour. Sixty-four tasks cannot be dated at any
price the reader should pay. The forge already renders history well; a link
hands the reader something better than we could build, and spends nothing.

So: a link per task, on the task's page. `HEAD` as the reference, like every
other read (see the note in the loader on why the default branch is never
resolved), and the branch when the repository was opened with one. It has to
carry the provider it points at rather than assuming GitHub, which is what
20260906-211255 will make matter.
