# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is M Note

M Note is a macOS desktop markdown editor built with Electron, React, and Tiptap. It opens `.md`/`.markdown` files (via double-click, drag-and-drop, or CLI args), provides rich-text editing with a toolbar, and saves back as markdown. It checks GitHub releases for updates and shows an in-app banner.

## Commands

- `npm start` — launch the dev app (Electron Forge + Vite HMR)
- `npm test` — run all tests (Vitest), including the editor package's
- `npm test -w @younghoandrewchaa/yeditor` — run only the editor package's tests
- `npx vitest run src/__tests__/foo.test.ts` — run a single test
- `npm run lint` — ESLint
- `npm run build:dmg` — build macOS DMG (calls `scripts/build-dmg.sh`)
- `npm run release` — full release pipeline: version bump, commit, tag, build DMG, push, GitHub release via `gh`

## Rules

- When fixing a bug or issue, always write a unit test that reproduces the problem before implementing the fix. App tests go in `src/__tests__/`; editor tests go in `packages/yeditor/src/__tests__/`.
- Code under `packages/yeditor/src` must not reference Electron, `window.electronAPI`, `__APP_VERSION__` or the `@/` alias (enforced by `boundary.test.ts`). Use relative imports there.

## Architecture

**Electron process split:**
- `src/main.ts` — main process. Creates windows, handles IPC (`read-file`, `save-file`, `check-for-update`, `open-external`), listens for `open-file` events (macOS file association for `.md`/`.markdown`).
- `src/preload.ts` — exposes `window.electronAPI` to the renderer via `contextBridge`. All renderer↔main communication goes through this API.
- `src/renderer.tsx` → `src/App.tsx` → `NoteEditor` (`src/note-editor.tsx`) → `YEditor`.

**Two layers:**
- `packages/yeditor/` — the npm workspace package `@younghoandrewchaa/yeditor`. A prop-driven React markdown editor (`YEditor`) with no Electron code, meant to be reused (e.g. in a blog). Props: `initialValue`, `onChange`, `onSave`/`canSave`, `onImageUpload`, `onOpenLink`, `toolbarEnd`, `onReady`; ref handle: `getMarkdown()`, `setMarkdown()`, `editor`.
- `src/note-editor.tsx` — the Electron wrapper. Owns file open/save/dirty-tracking, save-before-close, drag-and-drop, the `window.__*` update hooks, the update banner, the version label, and desktop-only toolbar buttons (`src/desktop-toolbar/`, `src/theme-toggle.tsx`) passed in via `toolbarEnd`.

**Component organisation under `packages/yeditor/src/components/`:**
- `tiptap-ui-primitive/` — generic UI atoms (Button, Toolbar, Popover, etc.)
- `tiptap-ui/` — editor-specific toolbar buttons and popovers (bold, link, headings, save, copy-markdown, etc.)
- `tiptap-node/` — custom Tiptap node extensions with their styles (code-block, frontmatter, image-upload, etc.)
- `tiptap-extension/` — custom Tiptap extensions (search, node background)
- `tiptap-icons/` — SVG icon components

**Styling:** SCSS. Theme variables live in `packages/yeditor/src/styles/_variables.scss` on `:root` / `.dark`; editor styles are scoped under `.yeditor` (no `html`/`body`/`*` rules — enforced by `yeditor-css.test.ts`). App-level page styles live in `src/note-editor.scss`. Vite uses `sass` with the `modern-compiler` API.

**Path aliases:** `@/` maps to `src/` (app only). `@younghoandrewchaa/yeditor` maps to `packages/yeditor/src/index.ts` in `tsconfig.json`, `vite.renderer.config.ts` and `vitest.config.ts`, so the app uses the editor's source directly (HMR, no build step).

**File handling flow:** macOS `open-file` event or CLI arg → main process `createWindow(filePath)` → renderer receives `file-opened` IPC → editor loads markdown content. Save: renderer calls `saveFile` IPC → main process writes to disk. On window close, a `save-before-close` IPC round-trip ensures unsaved changes are persisted.

**Update checker (`src/update-checker.ts`):** Polls the GitHub releases API for `younghoandrewchaa/m-note`, compares semver, and surfaces a DMG download link.

**Build:** Electron Forge with Vite plugin. Three Vite configs: `vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`. The app is code-signed and notarised for macOS (keychain profile `m-note`).
