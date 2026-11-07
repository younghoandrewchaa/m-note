# YEditor Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract M Note's Tiptap markdown editor into a reusable React package, `YEditor`, that a future React blog can install, with M Note becoming a thin Electron wrapper around it.

**Architecture:** Refactor in place first: build a prop-driven `YEditor` component with no Electron code and move all file/IPC/update logic into an app-side `NoteEditor` wrapper. Then remove global CSS, and finally `git mv` the editor code into an npm workspace at `packages/yeditor` with its own Vite library build. During development, M Note consumes the package **source** through a Vite/Vitest alias (so HMR keeps working with no build step). The blog consumes the built `dist/`.

**Tech Stack:** React 19, Tiptap 3 (`@tiptap/react`, `@tiptap/markdown`), SCSS (`sass` modern-compiler), Vite 5 library mode, Vitest 4 + jsdom, npm workspaces, Electron Forge 8 (unchanged).

**Spec:** No separate spec. The requirements are the investigation agreed in conversation on 2026-11-07 (option 2: refactor here into a reusable component shared through npm workspaces) and are copied into Global Constraints below.

## Global Constraints

- Component name: `YEditor`. npm package name: `@younghoandrewchaa/yeditor` (the unscoped `yeditor` is taken on npm). Workspace folder: `packages/yeditor`.
- Nothing under `packages/yeditor/src` may reference `window.electronAPI`, `__APP_VERSION__`, `electron`, the update checker, or file paths.
- `react` and `react-dom` (`^19`) are `peerDependencies` of the package, not `dependencies`.
- Package CSS must not use selectors on `html`, `body`, `*`, `#root`, `#app` or bare `::-webkit-scrollbar*`, and must not `@import` remote fonts. It **may** declare `--tt-*` custom properties on `:root` and `.dark`, because Radix popovers and dropdowns portal into `document.body`, outside any editor wrapper.
- Dark mode convention: a `.dark` class on an ancestor (normally `<html>`). The package ships no theme toggle.
- M Note's current behaviour must stay the same (open via Finder/CLI/drag-drop, Cmd+S, save-before-close, update banner, copy file path, check update, theme toggle, local `.md` links), with one intentional change: the image button disappears in M Note because its upload was a fake demo that always inserted a placeholder image.
- Bug-fix rule from CLAUDE.md still applies: any bug found while doing this gets a reproducing test in the relevant `__tests__` folder first.
- Code style: no semicolons (ESLint `semi: never`), double quotes in component files to match existing ones.
- `npm test`, `npm run lint` and `npm start` keep working from the repo root.

## Review Focus

1. **Radix popover/dropdown portals** (heading menu, highlight popover, link popover) render into `document.body`, outside the editor wrapper. They must still be themed after the CSS change → the CSS guard test in Task 2 must allow `--tt-*` vars on `:root`/`.dark`, and the manual check in Task 2 opens each popover in light and dark mode.
2. **Two editors on one page** (a blog admin page with an editor plus a preview, for example) must not share state → Task 1 test `two instances are independent`.
3. **SSR import** (Next.js renders on the server first): importing the package and `renderToString(<YEditor />)` must not throw on `window`/`document` → Task 3 test `ssr.test.tsx`.
4. **Frontmatter round-trip** through `initialValue` and `setMarkdown` (blog posts nearly always start with `---`) → Task 1 tests.
5. **Cmd+S without `onSave`** must leave the browser default alone and not swallow the key → Task 1 test `does not intercept mod+s without onSave`.

---

## File Structure

After Task 3:

```
package.json                    root: adds "workspaces": ["packages/*"], editor deps move out
vite.renderer.config.ts         adds alias "@younghoandrewchaa/yeditor" → packages/yeditor/src/index.ts
vitest.config.ts                same alias
tsconfig.json                   same path mapping
src/
  App.tsx                       renders <NoteEditor />
  note-editor.tsx               NEW: Electron wrapper (file open/save/close/drop, update banner, version label)
  note-editor.scss              NEW: app-only styles (update banner, version label, html/body, fonts)
  theme-toggle.tsx              MOVED from simple template (app-only)
  desktop-toolbar/              MOVED: copy-file-path-button, check-update-button
  components/update-banner.tsx  unchanged
  lib/local-markdown-link.ts    stays (used by NoteEditor's onOpenLink)
  lib/copy-file-path.ts         stays
  hooks/use-app-update.ts       stays
  editor-update-guard.ts        stays (operates on the Editor from handle.editor)
packages/yeditor/
  package.json  vite.config.ts  vitest.config.ts  tsconfig.json  tsconfig.build.json  README.md
  example/index.html  example/main.tsx      browser playground, no Electron
  src/
    index.ts                    public exports
    yeditor.tsx                 the component
    yeditor.scss                wrapper styles (from simple-editor.scss minus globals)
    yeditor-context.ts          YEditorConfigContext (onOpenLink)
    set-markdown.ts             frontmatter-aware load helper
    components/ hooks/ lib/ styles/   moved editor-only code
    __tests__/                  editor tests
```

`SaveButton` and `CopyMarkdownButton` are generic, so they move to the package (SaveButton only renders when `onSave` is given). `CopyFilePathButton` and `CheckUpdateButton` are desktop-only and stay in the app, injected through `toolbarEnd`.

## Public API (decided here, used by every task)

```ts
// packages/yeditor/src/index.ts (Task 1: src/yeditor/index.ts)
export interface YEditorProps {
  initialValue?: string                       // markdown, may start with frontmatter
  onChange?: () => void                       // every user edit; read with handle.getMarkdown()
  onSave?: () => void | Promise<void>         // enables Cmd+S and the Save button
  canSave?: boolean                           // Save button enabled state; default true
  onImageUpload?: (file: File, onProgress?: (e: { progress: number }) => void, signal?: AbortSignal) => Promise<string>
  onImageUploadError?: (error: Error) => void // default console.error
  onOpenLink?: (url: string) => void          // default: window.open(sanitized, "_blank", "noopener,noreferrer")
  toolbarEnd?: React.ReactNode                // extra buttons after the built-in groups
  className?: string                          // added to the wrapper div
  ariaLabel?: string                          // default "Main content area, start typing to enter text."
}
export interface YEditorHandle {
  editor: Editor | null
  getMarkdown(): string
  setMarkdown(markdown: string): void         // frontmatter-aware, does NOT fire onChange
}
export const YEditor: React.ForwardRefExoticComponent<YEditorProps & React.RefAttributes<YEditorHandle>>
export { MAX_FILE_SIZE } from "./lib/tiptap-utils"
export type { Editor } from "@tiptap/react"
```

`onChange` passes no markdown on purpose: serialising on every keystroke is costly. Consumers call `getMarkdown()` when they need the text (debounced autosave, publish).

---

### Task 1: YEditor component and NoteEditor wrapper (in place)

**Files:**
- Create: `src/yeditor/yeditor.tsx`, `src/yeditor/yeditor-context.ts`, `src/yeditor/set-markdown.ts`, `src/yeditor/index.ts`
- Create: `src/note-editor.tsx`
- Modify: `src/App.tsx` (render `NoteEditor`)
- Modify: `src/components/tiptap-ui/link-popover/link-popover.tsx`, `use-link-popover.ts:123-197` (drop `currentFilePath`; read `onOpenLink` from context)
- Modify: `src/lib/tiptap-utils.ts:361-388` (delete `handleImageUpload`; keep `MAX_FILE_SIZE`)
- Delete: `src/components/tiptap-templates/simple/simple-editor.tsx` (its `.scss` and `theme-toggle.tsx` stay put until Task 2)
- Test: `src/__tests__/yeditor.test.tsx`, `src/__tests__/note-editor.test.tsx`

**Interfaces:**
- Produces: `YEditor`, `YEditorProps`, `YEditorHandle` exactly as in the Public API section, exported from `@/yeditor`. `setMarkdownWithFrontmatter(editor: Editor, markdown: string): void` in `set-markdown.ts`. `YEditorConfigContext: React.Context<{ onOpenLink: (url: string) => void }>` in `yeditor-context.ts`.
- `NoteEditor(): JSX.Element` (no props) in `src/note-editor.tsx`.

- [ ] **Step 1: Write failing YEditor tests** in `src/__tests__/yeditor.test.tsx` (jsdom). Render with `createRoot` + `act` from `react`, as `update-banner.test.tsx` does, and don't add Testing Library. Pass a `ref` and wait until `ref.current?.editor` is non-null (a small `waitFor` loop with `vi.waitFor`), because `immediatelyRender: false` creates the editor after mount.

```tsx
it("loads initialValue and round-trips markdown", ...)
  // initialValue "# Title\n\nHello **world**" → getMarkdown() === same string
it("round-trips frontmatter from initialValue", ...)
  // "---\ntitle: Post\n---\n\n# Hi" → editor.state.doc.firstChild.type.name === "frontmatter"
  // and getMarkdown() starts with "---\ntitle: Post\n---"
it("setMarkdown replaces content with frontmatter and does not fire onChange", ...)
  // onChange = vi.fn(); ref.current.setMarkdown("---\na: 1\n---\n\nBody") → onChange not called, first node frontmatter
it("fires onChange on user edits", ...)
  // ref.current.editor.commands.insertContent("x") → onChange called once
it("mod+s calls onSave", ...)
  // fireEvent.keyDown(contenteditable, { key: "s", metaKey: true }) → onSave called
it("does not intercept mod+s without onSave", ...)
  // no onSave → the keydown event's defaultPrevented === false
it("hides Save and image buttons when their callbacks are absent", ...)
  // container has no button with aria-label/text "Save" and no ImageUploadButton (text "Add")
it("renders toolbarEnd content", ...)
  // toolbarEnd={<button>Publish</button>} → container.textContent contains "Publish"
it("passes onOpenLink through context", ...)
  // render a consumer of useLinkPopover inside <YEditor onOpenLink={spy}> with url "https://a.com", call openLink() → spy("https://a.com")
it("two instances are independent", ...)
  // two YEditors with separate refs; setMarkdown("A") on first → second getMarkdown() === its own initialValue
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `npx vitest run src/__tests__/yeditor.test.tsx`
Expected: FAIL, `Cannot find module '@/yeditor'`

- [ ] **Step 3: Implement `setMarkdownWithFrontmatter(editor, markdown)`** in `set-markdown.ts`: the `extractFrontmatter` → `setContent(body, { emitUpdate: false, contentType: "markdown" })` → `insertContentAt(0, frontmatter node)` sequence that `simple-editor.tsx` currently repeats twice (file-opened handler and drop handler).

- [ ] **Step 4: Implement `YEditor`** in `yeditor.tsx` as `forwardRef<YEditorHandle, YEditorProps>`. Start from `SimpleEditor` and keep: the extension list, the mobile/desktop toolbar switching, `useCursorVisibility`, `SearchPanel`, `InlineCodeCopyButton`. Remove: all `window.electronAPI` use, `useAppUpdate`, `UpdateBanner`, the version label, `window.__*` globals, the document-level drag/drop listeners, `currentFilePath`, `CopyFilePathButton`, `CheckUpdateButton`, `ThemeToggle` (moves to NoteEditor's `toolbarEnd` for now). Decisions:
  - Register `ImageUploadNode` and render `ImageUploadButton` only when `onImageUpload` is given. Keep `accept: "image/*"`, `maxSize: MAX_FILE_SIZE`, `limit: 3`.
  - Register `useHotkeys("mod+s", …)` with `enabled: !!onSave`. Keep `enableOnFormTags` and `enableOnContentEditable`.
  - Load `initialValue` once in an effect when `editor` first becomes non-null (via `setMarkdownWithFrontmatter`), not through `useEditor({ content })`, so frontmatter is handled the same way.
  - Expose the handle with `useImperativeHandle(ref, …, [editor])`.
  - Hold callbacks in refs so new inline lambdas don't recreate the editor.
  - Wrap children in `YEditorConfigContext.Provider value={{ onOpenLink }}`. The default `onOpenLink` is `window.open(sanitizeUrl(url, location.href), "_blank", "noopener,noreferrer")`, skipped when the result is `"#"`.
  - Root element: `<div className={cx("simple-editor-wrapper", "yeditor", className)}>`.

- [ ] **Step 5: Update link popover.** `useLinkPopover.openLink` calls `useContext(YEditorConfigContext).onOpenLink(url)` and nothing else. Delete the `currentFilePath` prop from `LinkPopover`, `LinkContent` and `useLinkPopover`. `isLocalMarkdownLink`/`resolveLocalMarkdownPath` are no longer imported here.

- [ ] **Step 6: Run the YEditor tests**

Run: `npx vitest run src/__tests__/yeditor.test.tsx`
Expected: PASS (10 tests)

- [ ] **Step 7: Write failing NoteEditor tests** in `src/__tests__/note-editor.test.tsx`, with `window.electronAPI` mocked as a full `ElectronAPI` object of `vi.fn()`s, `onX` subscribers capturing their callback and returning an unsubscribe:

```tsx
it("loads a file when file-opened fires", ...)
  // readFile resolves { path: "/a/b.md", content: "# B" }; trigger captured onFileOpened("/a/b.md")
  // → document.title === "b.md", editor text contains "B"
it("Cmd+S saves markdown to the current path", ...)
  // after opening /a/b.md and an edit → saveFile("/a/b.md", <markdown containing the edit>), title back to "b.md"
it("marks title dirty on edit", ...)  // → document.title === "● b.md"
it("save-before-close writes to savePath and replies success", ...)
  // trigger onSaveBeforeClose({ requestId: "r1", savePath: "/x.md" }) → saveFile("/x.md", …), setFilePath("/x.md"),
  // notifySaveComplete({ requestId: "r1", success: true })
it("opens local markdown links via openLocalFile and others via openExternal", ...)
  // the NoteEditor onOpenLink handler: "./c.md" with current file /a/b.md → openLocalFile("/a/c.md"); "https://x.y" → openExternal("https://x.y")
```

- [ ] **Step 8: Run them to confirm they fail**

Run: `npx vitest run src/__tests__/note-editor.test.tsx`
Expected: FAIL, `Cannot find module '../note-editor'`

- [ ] **Step 9: Implement `NoteEditor`** in `src/note-editor.tsx`. It holds a `YEditorHandle` ref and moves over, unchanged in behaviour, from `SimpleEditor`: path/dirty state and refs, `document.title` updates, `handleSave` (inside `runEditorTask(handle.editor, …)`, skipped when `isEditorUpdateFrozen`), the `onFileOpened`, `onSaveBeforeClose` and drag-drop effects (drop uses `handleFileDrop` with `setContent: md => handle.setMarkdown(md)`), the `window.__hasUnsavedChanges` / `__currentFilePath` / `__setUpdateFrozen` globals, `UpdateBanner`, and the `v{__APP_VERSION__}` label. Pass to YEditor: `onSave={handleSave}`, `canSave={isDirty && currentFilePath !== null}`, `onChange` = the dirty-tracking logic that was `editor.on("update")`, `onOpenLink` = the local/external branching removed from `use-link-popover.ts`, `toolbarEnd` = `<CopyFilePathButton filePath={currentFilePath} /> <CheckUpdateButton … /> <ThemeToggle />`. No `onImageUpload`.

- [ ] **Step 10: Run the full suite and lint**

Run: `npm test && npm run lint`
Expected: all tests pass, including the existing ones, and no lint errors.

- [ ] **Step 11: Manual smoke test.** Run `npm start`, open a `.md` with frontmatter from Finder, edit, Cmd+S, close the window with unsaved changes, click a `./other.md` link and an `https://` link, toggle the theme. Everything behaves as on `main`, and the image button is gone.

- [ ] **Step 12: Commit**

```bash
git add -A src
git commit -m "refactor: split editor into prop-driven YEditor and Electron NoteEditor wrapper"
```

---

### Task 2: Remove global CSS from the editor

**Files:**
- Create: `src/yeditor/yeditor.scss` (from `simple-editor.scss`, scoped), `src/note-editor.scss`
- Move: `src/components/tiptap-templates/simple/theme-toggle.tsx` → `src/theme-toggle.tsx`
- Delete: `src/components/tiptap-templates/` (whole folder)
- Modify: `src/yeditor/yeditor.tsx` (import `./yeditor.scss`), `src/note-editor.tsx` (import `./note-editor.scss`, new ThemeToggle path)
- Test: `src/__tests__/yeditor-css.test.ts`

**Interfaces:**
- Consumes: `YEditor` from Task 1.
- Produces: `src/yeditor/yeditor.scss` as the single style entry YEditor imports. Later tasks compile this file to check it.

- [ ] **Step 1: Write the failing CSS guard test** `yeditor-css.test.ts`. It compiles the editor's style entry with `sass.compile(path, { loadPaths: [...] })` and collects every top-level selector with a regex over the output (or `postcss` if it is already in `node_modules`).

```ts
it("has no global element selectors", ...)
  // every selector, split on ",", trimmed: none matches /^(html|body|\*|#root|#app)\b/ and none starts with "::-webkit-scrollbar"
it("does not import remote fonts", ...)       // css does not contain "fonts.googleapis.com"
it("keeps theme variables on :root and .dark", ...)  // css contains ":root" and ".dark" rules declaring "--tt-bg-color"
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/__tests__/yeditor-css.test.ts`
Expected: FAIL. The first two tests fail on `body`/`html` and the Google Fonts import.

- [ ] **Step 3: Scope the styles.** In `yeditor.scss`, move the `body { --tt-toolbar-height … }` block, `font-family`/`color`, scrollbar rules and `* { scrollbar-* }` under `.yeditor` (scrollbar pseudo-elements become `.yeditor ::-webkit-scrollbar`). Leave `_variables.scss` `:root`/`.dark` as they are. Move the Google Fonts import, `html, body, #root` height/background/overscroll, and the `.update-banner` / `.version-label` rules into `note-editor.scss`. Inline-code and node SCSS imports stay with YEditor.

- [ ] **Step 4: Run the CSS test, then the whole suite**

Run: `npx vitest run src/__tests__/yeditor-css.test.ts && npm test`
Expected: PASS

- [ ] **Step 5: Manual check (Review Focus 1).** Run `npm start`, then in light **and** dark mode open the heading dropdown, list dropdown, highlight popover and link popover. Each one has themed colours and the page scrollbar looks as before.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "refactor: scope YEditor styles and move app-level CSS to NoteEditor"
```

---

### Task 3: Move YEditor into the `packages/yeditor` workspace

**Files:**
- Create: `packages/yeditor/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts` (moved from `src/yeditor/index.ts`)
- Move (`git mv`) into `packages/yeditor/src/`: `src/yeditor/*`, `src/components/{tiptap-extension,tiptap-icons,tiptap-node,tiptap-ui,tiptap-ui-primitive}` **except** `tiptap-ui/copy-file-path-button` and `tiptap-ui/check-update-button`, `src/hooks/*` **except** `use-app-update.ts`, `src/lib/{tiptap-utils,frontmatter,copy-code,inline-code-copy}.ts`, `src/styles/`
- Move (`git mv`) into `src/desktop-toolbar/`: `copy-file-path-button/`, `check-update-button/`
- Move tests (`git mv`) into `packages/yeditor/src/__tests__/`: `yeditor*.test.*`, `code-block-copy`, `code-block-nested-fence`, `frontmatter`, `inline-code-copy`, `mermaid-*`, `search-extension`, `table-overflow`
- Modify: root `package.json`, `tsconfig.json`, `vite.renderer.config.ts`, `vitest.config.ts`, `src/index.scss`, `src/note-editor.tsx`, `CLAUDE.md` (Architecture section)
- Test: `packages/yeditor/src/__tests__/boundary.test.ts`, `packages/yeditor/src/__tests__/ssr.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–2.
- Produces: the package `@younghoandrewchaa/yeditor`, whose `src/index.ts` exports the Public API plus `Button` (from `tiptap-ui-primitive/button`, needed by `desktop-toolbar` and `ThemeToggle`). The app imports only from `"@younghoandrewchaa/yeditor"` and never uses deep paths.

- [ ] **Step 1: Write failing boundary and SSR tests**

```ts
// boundary.test.ts: walk packages/yeditor/src (excluding __tests__) with fs
it("has no Electron or app coupling", ...)
  // no file content matches /electronAPI|__APP_VERSION__|from ["']electron["']|update-checker/
it("uses no @/ alias imports", ...)            // no file matches /from ["']@\//

// ssr.test.tsx, first line: // @vitest-environment node
it("imports and server-renders without touching window", async () => {
  const { YEditor } = await import("../index")
  expect(() => renderToString(<YEditor initialValue="# Hi" />)).not.toThrow()
})
```

If `.scss` imports break the Node environment, set `css: false` or a `\.scss$` stub in the package Vitest config. Do not remove the imports from components.

- [ ] **Step 2: Run them to confirm they fail**

Run: `npx vitest run packages/yeditor/src/__tests__/boundary.test.ts`
Expected: FAIL with ENOENT, because the folder doesn't exist yet.

- [ ] **Step 3: `git mv` the files listed above.** Then rewrite every `@/…` import inside `packages/yeditor/src` to a relative path with a one-off script kept in the scratchpad, not the repo:

```js
// for each .ts/.tsx/.scss file F under packages/yeditor/src:
//   replace /(["'])@\/([^"']+)\1/g with
//   quote + toPosix(path.relative(dirname(F), "packages/yeditor/src/" + p)) (prefix "./" if not starting with ".") + quote
```

Fix the moved tests' `../components/...` imports by hand (they become `../components/...` relative to the new `__tests__`, so most stay the same).

- [ ] **Step 4: Create `packages/yeditor/package.json`.** `"name": "@younghoandrewchaa/yeditor"`, `"version": "0.1.0"`, `"type": "module"`, `"sideEffects": ["**/*.scss", "**/*.css"]`, `"peerDependencies": { "react": "^19.0.0", "react-dom": "^19.0.0" }`. `dependencies`: move from root every package that only the moved files import (all `@tiptap/*`, `@floating-ui/react`, `@radix-ui/*`, `highlight.js`, `lowlight`, `pele`, `lodash.throttle`, `react-hotkeys-hook`, and `@base-ui/react` plus `class-variance-authority`, which primitives import even though root lists them as devDependencies). Before removing anything from root, check with `grep -rn "<pkg>" src` that the app no longer uses it. `"scripts": { "test": "vitest run" }`. Add `"workspaces": ["packages/*"]` to the root, then run `npm install`.

- [ ] **Step 5: Wire the aliases.** Map `"@younghoandrewchaa/yeditor"` → `packages/yeditor/src/index.ts` in `vite.renderer.config.ts` `resolve.alias`, `vitest.config.ts`, and `tsconfig.json` `paths`. Add `packages/yeditor/vitest.config.ts` (jsdom). Root `"test"` becomes `"vitest run --project app && npm test -w @younghoandrewchaa/yeditor"`, or use Vitest `test.projects` if it works cleanly with the root config. Check `npx ctx7` docs for Vitest 4 `projects` before choosing. Either way, `npm test` at root must run both suites. Keep `package-lock.test.ts` green: workspace links must not resolve to `git+`.

- [ ] **Step 6: Run everything**

Run: `npm test && npm run lint`
Expected: all app and package tests pass, including boundary and SSR, and no lint errors.

- [ ] **Step 7: Manual smoke test.** Repeat Task 1 Step 11 and Task 2 Step 5 with `npm start`, then edit a file in `packages/yeditor/src` and confirm HMR reloads it.

- [ ] **Step 8: Update CLAUDE.md.** Change the Architecture section to describe the `packages/yeditor` / `src/note-editor.tsx` split and the alias, and add `npm test -w @younghoandrewchaa/yeditor` to Commands.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: move YEditor into packages/yeditor workspace"
```

---

### Task 4: Library build, browser playground and README

**Files:**
- Create: `packages/yeditor/vite.config.ts`, `tsconfig.build.json`, `example/index.html`, `example/main.tsx`, `README.md`, `scripts/check-dist.mjs`
- Modify: `packages/yeditor/package.json` (`exports`, `files`, scripts)
- Modify: `scripts/build-dmg.sh` only if Forge packaging breaks (it shouldn't, because the app bundles the package source through the alias)

**Interfaces:**
- Consumes: `packages/yeditor/src/index.ts` from Task 3.
- Produces: `dist/index.js` (ESM), `dist/index.d.ts`, `dist/style.css`, and these package.json fields:
  `"exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }, "./style.css": "./dist/style.css" }`, `"files": ["dist"]`. The blog uses `import { YEditor } from "@younghoandrewchaa/yeditor"` and `import "@younghoandrewchaa/yeditor/style.css"`.

- [ ] **Step 1: Write the failing dist check.** `scripts/check-dist.mjs` exits non-zero unless: `dist/index.js`, `dist/index.d.ts` and `dist/style.css` exist; `index.js` contains no `from "react"` bundled copy (it must import `react` as external, so `/\bfrom\s*["']react["']/` matches and no `react-dom/cjs` string appears); `index.d.ts` mentions `YEditorProps` and `YEditorHandle`; `style.css` passes the same global-selector rule as the Task 2 test (import a shared `assertNoGlobalSelectors(css: string)` from `src/lib/css-guard.ts`; move the Task 2 test's logic there so both use one implementation).

- [ ] **Step 2: Run it to confirm it fails**

Run: `node packages/yeditor/scripts/check-dist.mjs`
Expected: FAIL, `dist/index.js missing`

- [ ] **Step 3: Configure the build.** Use Vite 5 library mode with `build.lib = { entry: "src/index.ts", formats: ["es"], fileName: "index" }`. Set `rollupOptions.external` to every key of `dependencies` and `peerDependencies`, plus subpaths (`/^react(\/|$)/`, `/^@tiptap\//`, and so on). Add `@vitejs/plugin-react` and SCSS `api: "modern-compiler"`. Vite 5 names the CSS `style.css`. For types, run `tsc -p tsconfig.build.json` (`emitDeclarationOnly`, `declaration`, `outDir: dist`, excluding `__tests__` and `example`), with a `*.scss` module declaration. Scripts: `"build": "vite build && tsc -p tsconfig.build.json && node scripts/check-dist.mjs"`, `"dev": "vite example"`.

- [ ] **Step 4: Build and run the check**

Run: `npm run build -w @younghoandrewchaa/yeditor`
Expected: build succeeds and check-dist prints OK.

- [ ] **Step 5: Add the playground.** `example/main.tsx` renders a blog-like page: `<YEditor initialValue={sample post with frontmatter} onSave={() => console.log(ref.current.getMarkdown())} onImageUpload={file => Promise.resolve(URL.createObjectURL(file))} toolbarEnd={<button>Publish</button>} />`, a dark-mode checkbox that toggles `document.documentElement.classList`, and a `<pre>` markdown preview updated on `onChange`. Run `npm run dev -w @younghoandrewchaa/yeditor`, open the URL, and confirm that typing, popovers in both themes, image insert, Cmd+S logging, and the frontmatter block all work in a plain browser.

- [ ] **Step 6: Write README.md.** Cover install, the two imports, a props table (copy the Public API comments), the `.dark` convention, Inter font loading being the consumer's job, and Next.js usage (render it from a `"use client"` component; `ssr: false` isn't needed, and the editor appears after hydration).

- [ ] **Step 7: Confirm the desktop build still packages.** Run `npm run build:dmg` locally or at least `npx electron-forge package`. Expected: success, and the app opens files as before.

- [ ] **Step 8: Commit**

```bash
git add -A packages/yeditor
git commit -m "build: add YEditor library build, playground and README"
```

Publishing to npm (`npm publish -w @younghoandrewchaa/yeditor --access public`) is a separate, user-initiated step and is out of scope for this plan.
