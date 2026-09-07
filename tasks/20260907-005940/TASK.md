# The board has no filter bar

- STATUS: OPEN
- PRIORITY: 80
- TAGS: ui,tql

20260906-211227 shipped the board without the query bar the list has, so there
is no way to look at one part of it — `:ui`, or `priority ge 90`, or `~windows`.

It is wanted here for a different reason than on the list. The dashboard
deliberately has no filter, because a chart of a subset says things that are
untrue of the repository and the reader is left interpreting a picture. A board
is not a summary: filtering it narrows what each column holds and the columns
still mean exactly what their headers say. Filtering by tag is also the closest
thing this format has to a swimlane.

Mostly reuse. `QueryState` already lives in the layout, so a filtered board
would share the query with the list — go to the list from a filtered board and
find the same filter, which is the behaviour everywhere else. Two things to
settle:

- **What the counts count.** A column header showing 21 while displaying 3 is a
  lie; showing 3 loses the sense of how much was set aside. Probably `3 / 21`.
- **What the `closed` toggle means here.** Done *is* the closed column, so
  hiding closed tasks would empty it. Either the toggle disappears on this view
  or it hides the column outright, which is arguably what a reader asking for
  open tasks wants.
