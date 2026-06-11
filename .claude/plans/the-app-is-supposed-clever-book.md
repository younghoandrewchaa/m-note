# Fix native macOS auto-update

## Context

The app is meant to check for updates on launch and on opening a document, but no
update ever surfaces on the packaged macOS app. Investigation found the root cause:

**The release pipeline never publishes what the native auto-updater needs.**

Flow today:
- Renderer calls `checkForUpdate()` on launch (`simple-editor.tsx:339`) and on file
  open (`:368`).
- Main handler `check-for-update` (`main.ts:37`) short-circuits: on any packaged
  macOS build a Squirrel.Mac feed URL is configured, so `checkForNativeUpdate()`
  returns `true`, the manual GitHub-API check is skipped, and it defers entirely to
  Electron's native `autoUpdater`.
- `auto-updater.ts:13` points the native feed at
  `…/releases/latest/download/RELEASES.json`. Squirrel.Mac (`serverType: 'json'`)
  *does* accept maker-zip's nested `{ currentRelease, releases:[{updateTo}] }`
  manifest — the design is correct.
- **But** `release.sh` builds and uploads only the DMG
  (`npx electron-forge make --targets @electron-forge/maker-dmg`). The `.zip` +
  `RELEASES.json` that `MakerZIP` (configured with `macUpdateManifestBaseUrl` in
  `forge.config.ts:40`) would produce are never built or uploaded. Confirmed on
  GitHub: the latest release `v1.1.14` has only `M.Note-1.1.14-arm64.dmg`.

So the feed URL 404s, the native updater fails silently (error only `console.error`'d
in `auto-updater.ts:39`), and because the manual check is suppressed, nothing appears.

**Critical asset-naming gotcha** (`node_modules/@electron-forge/maker-zip/dist/MakerZIP.js:26,44`):
`MakerZIP` names the zip `M Note-darwin-arm64-<ver>.zip` (contains a space) and writes
the manifest `updateTo.url` as `…/download/M%20Note-…zip`. GitHub replaces spaces with
dots on asset upload (that's why the DMG is `M.Note-…`), so the manifest URL would not
resolve to the uploaded asset → another 404. The zip filename and the manifest URL must
be normalized to the same space-free name before upload.

Intended outcome: a published release carries a signed `.zip` + a correct
`RELEASES.json`, so an installed older build silently downloads the update and shows the
"ready to install" banner (`type: 'native'` in `simple-editor.tsx:346` / banner at
`:420`).

## Changes

### 1. Build the zip + manifest in the release pipeline — `scripts/release.sh`
- Change the build step to also run the zip maker:
  `npx electron-forge make --targets @electron-forge/maker-dmg,@electron-forge/maker-zip`.
  (The zip maker emits the `.zip` and, because `macUpdateManifestBaseUrl` is set,
  `RELEASES.json`, at `out/make/zip/darwin/<arch>/`.)
- Locate all three artifacts: the DMG (existing logic), the `.zip`, and `RELEASES.json`.
- Normalize the zip + manifest (see step 2) so the asset name matches the manifest URL.
- Upload **all three** assets (DMG, normalized zip, RELEASES.json) via
  `gh release create` / `gh release upload --clobber`.
- Extend the "already fully released" short-circuit (`release_exists && dmg_asset_attached`,
  `release.sh:39`) to also require the `.zip` and `RELEASES.json` assets, so a partial
  prior run (DMG-only, like the current state) re-runs and finishes the upload rather than
  exiting early.

### 2. Normalize asset name ↔ manifest URL — new small testable helper
Add a tiny Node helper (e.g. `scripts/fix-mac-update-manifest.mjs`) that release.sh calls,
which:
- Computes the space-free asset name GitHub will use (replace spaces with `.`), renames
  the local zip to that name.
- Rewrites every `releases[].updateTo.url` in `RELEASES.json` so its final path segment
  equals the normalized zip filename (decode `%20`, apply the same space→dot rule).
- Writes `RELEASES.json` back.

Extracting this into a helper (rather than inline bash `sed`) keeps it unit-testable per
the repo's TDD rule.

### 3. Test first — `src/__tests__/`
Per CLAUDE.md ("write a unit test that reproduces the problem before implementing the
fix"), add `src/__tests__/fix-mac-update-manifest.test.ts` that:
- Feeds a manifest whose `updateTo.url` ends in `M%20Note-darwin-arm64-1.1.15.zip` and a
  zip named with a space, and asserts the helper returns a normalized name
  `M.Note-darwin-arm64-1.1.15.zip` and a manifest URL whose last segment matches it
  exactly (no `%20`, no space). This reproduces the 404 mismatch and locks in the fix.

## Files
- `scripts/release.sh` — build + upload zip & RELEASES.json; tighten short-circuit.
- `scripts/fix-mac-update-manifest.mjs` (new) — normalize zip name + manifest URL.
- `src/__tests__/fix-mac-update-manifest.test.ts` (new) — failing-first test.
- No change needed to `auto-updater.ts`, `main.ts`, or `simple-editor.tsx`: the native
  path is correct once the assets are published.

## Verification
1. `npm test` — new manifest-normalization test passes (and was written to fail first).
2. Bump version: `npm version patch --no-git-tag-version`, commit.
3. `npm run release -- "auto-update test"` — confirm console shows DMG, zip, and
   RELEASES.json all uploaded.
4. Confirm the published assets and that the feed resolves end-to-end:
   - `gh release view <tag> --json assets -q '.assets[].name'` lists the `.dmg`, `.zip`,
     and `RELEASES.json`.
   - `curl -sL https://github.com/younghoandrewchaa/m-note/releases/latest/download/RELEASES.json`
     returns the manifest; its `updateTo.url` must be a 302→200 (the zip), verified with
     `curl -sI -o /dev/null -w '%{http_code}' "<that url>"`.
5. End-to-end: install the previous version, launch it (or open a `.md`), and confirm the
   `auto-update-downloaded` event fires and the "…is ready to install" banner appears;
   clicking it calls `installNativeUpdate()` → `quitAndInstall`.
