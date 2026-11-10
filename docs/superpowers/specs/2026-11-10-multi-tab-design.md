# Multi-tab documents — design

Agreed in a grilling session on 2026-11-10.

## Decisions

1. **Native macOS window tabs.** Each document stays its own `BrowserWindow`. Windows share the `tabbingIdentifier` `m-note` and are grouped into tabs with `addTabbedWindow`. Tabs are forced, whatever the macOS "Prefer tabs" setting says. Electron has no `tabbingMode` option, so new windows are always attached explicitly.
2. **Switching tabs.** Cmd+Shift+[ goes to the previous tab and Cmd+Shift+] to the next, through the native `selectPreviousTab` / `selectNextTab` menu roles. Both wrap around. There is no Cmd+1…9.
3. **New and close.** Cmd+T and Cmd+N both open a new `Untitled` tab, and so does the tab bar "+" button (`app` `new-window-for-tab`). Cmd+W closes the current tab and goes through the existing Save / Don't Save / Cancel prompt.
4. **Where documents open.** Files from Finder (`open-file`), CLI args, a clicked local `.md` link, or a drag-and-drop open in a tab of the *anchor window*. The anchor is the focused window, or the most recently focused one if none has focus.
   - If the file is already open, its tab gets focus instead.
   - If the anchor tab is `Untitled` and unedited, the file loads into it.
   - Otherwise the file gets a new tab.
5. **Drag-and-drop** opens every dropped `.md`/`.markdown` file using the rules in 4. It no longer replaces the current document.
6. **Save As.** Cmd+S on an untitled tab opens a save dialog (default `Untitled.md`, Markdown filter). After saving, the tab takes the chosen path.
7. **Cmd+Q** goes through the unsaved tabs in turn. Each one is brought to the front before its prompt. Cancel (or cancelling the save dialog) stops the quit, and no tab closes.
8. **Closing the last tab quits the app.** This is the existing `window-all-closed` behaviour.
9. **Titles.** The main process owns window titles, and the tab label is the window title.
   - A saved document shows its file name.
   - Untitled documents are labelled `Untitled`, `Untitled 2`, … using the lowest free number.
   - Unsaved changes add a `● ` prefix.
   - No `setDocumentEdited` or `setRepresentedFilename`.
10. **Update restart** restores the tabs in creation order and focuses the tab that was active. The session file must still accept the old array format written by older versions.
11. **No restore on a normal relaunch.**
12. **Testing.** Decision logic lives in pure functions in `src/`, tested first with Vitest. The native tab bar and shortcuts are checked by hand with `npm start`. No Playwright.

## Known limitation

Electron cannot read the tab order of a tab group. "Same order" after an update restart therefore means creation order. Tabs reordered by dragging come back in creation order. Several tab groups (tabs dragged out into their own windows) come back as one group.
