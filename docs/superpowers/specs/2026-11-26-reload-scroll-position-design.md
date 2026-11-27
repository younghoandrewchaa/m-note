# Keep scroll position across Cmd+R reload

## Intent
Cmd+R is mainly used to pick up changes made to the open file by something else.
Today the reload drops the reader back at the top of the document, and they have to
scroll back to where they were. After a reload they should land where they were reading.

## Goals / non-goals
- Goal: after Cmd+R on a tab with a saved file, restore that tab's scroll position.
- Non-goal: remembering position when a file is reopened later, after app restart, or
  after an update restart.
- Non-goal: Untitled tabs (a reload discards their content, so there is nothing to return to).
- Accepted limitation: if content above the reading spot changes, the view may land a
  little above or below the old spot. That's acceptable (chosen over block anchoring).

## Approaches
- **A. Pixel position (chosen).** Save `.yeditor`'s `scrollTop` before unload and set it
  back after the reloaded content loads. Simple; drifts when content above changes.
- B. Anchor to the top-visible block (text + index + offset). Robust to edits above, but
  roughly 4x the code. The user judged A sufficient.
- C. Make Cmd+R reload the file without reloading the page. Loses the real page reload, and still drifts.

## Design
- A small helper in `src/` (for example `src/scroll-restore.ts`) with two functions:
  - `saveScrollPosition(filePath, scrollTop)` stores `{ filePath, scrollTop }` in
    `sessionStorage` (per window, so per tab; survives reload; never written to disk).
  - `takeScrollPosition(filePath)` returns the saved `scrollTop` if the stored
    `filePath` matches, and always clears the entry.
- `note-editor.tsx`:
  - On `beforeunload`, if there is a current file path, save the scroll container's
    `scrollTop`. The container is the `.yeditor` element (`editor.view.dom.closest('.yeditor')`).
  - In the `onFileOpened` handler, after `setMarkdown`, take the saved position for that
    path and, if present, apply it on the next animation frame (after layout).
- The editor package (`packages/yeditor`) is unchanged.

## Testing
- Unit tests for the helper: save then take returns the value; a mismatched path returns
  nothing; the entry is cleared after take.
- A `note-editor` test: with a saved position, a `file-opened` for the same path restores
  `scrollTop`.

## Left to the builder
Exact file and function names, and how to fake layout in tests (jsdom has no layout, so
set and read `scrollTop` directly).
