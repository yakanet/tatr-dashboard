# Dashboard driven by the TQL query

- STATUS: OPEN
- PRIORITY: 100
- TAGS: ui,tql

The query is global state and every chart is both a visualisation and a
control: clicking a tag bar appends `:bug` to the query, everything recomputes,
and the URL reflects it.

The format offers only four dimensions — binary status, numeric priority, tags,
creation date from the HUID. There are no closure dates, so burndown, cycle time
and "closed this month" are impossible. The activity chart plots creations split
by present status; anything else would be invented.
