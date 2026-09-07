# store.list pairs keys with values across two transactions

- STATUS: OPEN
- PRIORITY: 80
- TAGS: data

`RepoStore.list` reads `getAllKeys()` and `getAll()` in separate transactions
and then pairs them by index:

    const keys = await transact('readonly', (store) => store.getAllKeys());
    const values = await transact('readonly', (store) => store.getAll());
    if (!keys || !values || keys.length !== values.length) return [];

A write landing between the two — the loader finishing a repository while the
homepage reads the cache — leaves the arrays describing different states. The
length guard catches the easy case and guarantees nothing about the pairing,
while the code depends entirely on the order.

Read both in one transaction, which the API allows: open it once and issue both
requests against the same store. Not observed in the wild, and the point is that
it could not be observed reliably either.
