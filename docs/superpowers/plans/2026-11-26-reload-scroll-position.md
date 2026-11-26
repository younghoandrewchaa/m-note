# Keep Scroll Position Across Cmd+R Reload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After Cmd+R on a tab with a saved file, the reader lands back at the same scroll offset.

**Architecture:** A tiny `sessionStorage`-backed helper stores `{ filePath, scrollTop }` per window (per tab). `NoteEditor` saves `.yeditor`'s `scrollTop` on `beforeunload` and, after `setMarkdown` in the `file-opened` handler, takes the saved value for that path and applies it on the next animation frame.

**Tech Stack:** TypeScript, React, Tiptap, Vitest (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-26-reload-scroll-position-design.md`

## Global Constraints

- Only Cmd+R reload of a tab with a saved file; no restore on later reopen, app restart, or update restart.
- Untitled tabs are not handled.
- Pixel position only (`scrollTop` of the `.yeditor` element); no block anchoring.
- `packages/yeditor` is unchanged. App code uses the `@/` alias as elsewhere in `src/`.
- Stored in `sessionStorage` only; nothing written to disk.

## Review Focus

1. A saved entry for file A must not scroll a tab later showing file B → test in Task 1 (mismatched path) and Task 2.
2. Opening the same file again without a reload must not re-apply an old position → entry is cleared on take; test in Task 1.
3. Corrupt or foreign `sessionStorage` content must not crash file loading → `takeScrollPosition` returns `undefined`; test in Task 1.
4. `sessionStorage` throwing (e.g. quota) must not block unload or loading → both helpers swallow storage errors; test in Task 1.
5. An Untitled tab (no path) must not save anything on unload → test in Task 2.

---

### Task 1: Scroll position helper

**Files:**
- Create: `src/scroll-restore.ts`
- Test: `src/__tests__/scroll-restore.test.ts`

**Interfaces:**
- Produces:
  - `saveScrollPosition(filePath: string, scrollTop: number): void`
  - `takeScrollPosition(filePath: string): number | undefined` — returns the stored `scrollTop` only if the stored `filePath` matches; always removes the entry.
  - Storage key: `"m-note:scroll-position"`.

- [ ] **Step 1: Write the failing tests** (`// @vitest-environment jsdom`, `beforeEach(() => sessionStorage.clear())`)

```ts
it("returns the saved position for the same file", () => {
  saveScrollPosition("/a.md", 420)
  expect(takeScrollPosition("/a.md")).toBe(420)
})
it("returns nothing for a different file", () => {
  saveScrollPosition("/a.md", 420)
  expect(takeScrollPosition("/b.md")).toBeUndefined()
})
it("clears the entry after taking it", () => {
  saveScrollPosition("/a.md", 420)
  takeScrollPosition("/a.md")
  expect(takeScrollPosition("/a.md")).toBeUndefined()
})
it("ignores corrupt stored data", () => {
  sessionStorage.setItem("m-note:scroll-position", "{not json")
  expect(takeScrollPosition("/a.md")).toBeUndefined()
})
it("swallows storage errors", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota") })
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied") })
  expect(() => saveScrollPosition("/a.md", 1)).not.toThrow()
  expect(takeScrollPosition("/a.md")).toBeUndefined()
})
```
(Add `afterEach(() => vi.restoreAllMocks())`.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/scroll-restore.test.ts`
Expected: FAIL — cannot resolve `../scroll-restore`.

- [ ] **Step 3: Implement both functions in `src/scroll-restore.ts`**

JSON-encode `{ filePath, scrollTop }`; on take, validate `typeof scrollTop === "number"`; wrap storage access and `JSON.parse` in `try/catch`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/__tests__/scroll-restore.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/scroll-restore.ts src/__tests__/scroll-restore.test.ts
git commit -m "Add scroll position helper for reload"
```

### Task 2: Wire save/restore into NoteEditor

**Files:**
- Modify: `src/note-editor.tsx` (the `onFileOpened` effect, ~lines 127-137; add a `beforeunload` effect)
- Test: `src/__tests__/note-editor.test.tsx`

**Interfaces:**
- Consumes: `saveScrollPosition`, `takeScrollPosition` from `@/scroll-restore` (Task 1).
- Scroll container: `handle.editor.view.dom.closest<HTMLElement>(".yeditor")`.

- [ ] **Step 1: Write the failing tests** in `src/__tests__/note-editor.test.tsx` (add `sessionStorage.clear()` to `beforeEach`; jsdom has no layout, so read/write `scrollTop` directly; `requestAnimationFrame` exists in jsdom — use `vi.waitFor`)

```ts
const scroller = () => host.querySelector(".yeditor") as HTMLElement

it("saves the scroll position of the open file before unload", async () => {
  await openFile("/notes/a.md")
  scroller().scrollTop = 300
  window.dispatchEvent(new Event("beforeunload"))
  expect(takeScrollPosition("/notes/a.md")).toBe(300)
})

it("does not save a position for an untitled tab", () => {
  scroller().scrollTop = 300
  window.dispatchEvent(new Event("beforeunload"))
  expect(sessionStorage.getItem("m-note:scroll-position")).toBeNull()
})

it("restores the saved scroll position when the same file is reopened after reload", async () => {
  saveScrollPosition("/notes/a.md", 300)
  await openFile("/notes/a.md")
  await vi.waitFor(() => expect(scroller().scrollTop).toBe(300))
})

it("does not restore a position saved for another file", async () => {
  saveScrollPosition("/notes/a.md", 300)
  await openFile("/notes/b.md")
  await new Promise((r) => requestAnimationFrame(() => r(undefined)))
  expect(scroller().scrollTop).toBe(0)
})
```
(Import `saveScrollPosition`, `takeScrollPosition` from `../scroll-restore`.)

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/__tests__/note-editor.test.tsx`
Expected: "saves the scroll position…" and "restores the saved scroll position…" FAIL; the other two may already pass.

- [ ] **Step 3: Implement in `src/note-editor.tsx`**

- New effect depending on `[handle]`: add a `beforeunload` listener that, when `currentFilePathRef.current` is set and the `.yeditor` container exists, calls `saveScrollPosition(path, container.scrollTop)`; remove it on cleanup.
- In the `onFileOpened` task, after `handle.setMarkdown(content)` and `markClean(filePath)`: `const top = takeScrollPosition(filePath)`; if defined, `requestAnimationFrame(() => { container.scrollTop = top })`.

- [ ] **Step 4: Run the full suite**

Run: `npm test && npm run lint`
Expected: all tests pass, no lint errors (including `boundary.test.ts`, confirming `packages/yeditor` is untouched).

- [ ] **Step 5: Manual check**

`npm start`, open a long `.md` file, scroll halfway, press Cmd+R → view returns to the same spot. Open a second file in a new tab, Cmd+R there → each tab keeps its own spot.

- [ ] **Step 6: Commit**

```bash
git add src/note-editor.tsx src/__tests__/note-editor.test.tsx
git commit -m "Keep scroll position across Cmd+R reload"
```
