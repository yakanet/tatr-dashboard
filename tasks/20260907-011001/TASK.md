# Esc does not close the keyboard panel

- STATUS: OPEN
- PRIORITY: 100
- TAGS: ui

The panel lists `Esc — close, or leave the box` and Esc does nothing to it. Only
the Close button works, which is the one thing a keyboard panel should not
require.

`KeyHelp` focuses itself on open, then carries
`onkeydown={(event) => event.stopPropagation()}` on the panel — added so a key
pressed inside it would not reach the backdrop. With the focus inside, that stop
also keeps Escape from reaching `<svelte:window>` in `Shortcuts`, which is where
`dismiss()` lives, so the shortcut the panel advertises is the one it swallows.

Handle Escape in `KeyHelp` itself rather than relying on the layer it is
blocking, or stop only what actually needs stopping. Whichever way, the fix
belongs with 20260907-011002: a panel that owns its own Escape is also a panel
that has to hold the focus.
