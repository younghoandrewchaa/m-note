# Electron Forge 8 Upgrade Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task after user review. Steps use checkbox syntax for tracking. No parallel delegation is needed.

**Goal:** Move every `@electron-forge/*` package from 7.11.x to 8.0.1 so `npm ci` works on npm 12 (`allow-git=none`) without the `@electron/node-gyp` override, and the signed, notarised DMG/ZIP release still works end to end.

**Architecture:** Keep Forge, the Vite plugin, Squirrel.Mac native updates and the existing release scripts. Change only dependency versions and whatever config Forge 8 requires.

**Tech Stack:** Electron 42, Electron Forge 7.11 → 8.0.1, Vite 5, TypeScript 5.5, Node 24 (local v24.22.1, CI `node-version: 24`), npm 12.2.1.

**Spec:** Proposed plan, not an approved implementation. Do not bump the app version or publish a release as part of this work.

## Design and scope

Forge 7.x requires `@electron/rebuild ^3.7.0`, which pulls `@electron/node-gyp` from a git commit. npm 12 refuses that with `EALLOWGIT`. The current workaround is an `overrides` entry pinning the registry copy of `@electron/node-gyp@10.2.0-electron.1`. Forge 8 depends on `@electron/rebuild ^4.2.0`, which uses the registry `node-gyp ^12.2.0`, so the override can be removed.

**Known from npm registry metadata (8.0.1, released 2026-09-29):**
- Every `@electron-forge/*` package is `"type": "module"` with `engines.node >= 22.13.0`. Local and CI Node 24 satisfy this.
- `@electron-forge/shared-types` → `@electron/rebuild ^4.2.0` (ESM-only, Node >= 22.12) and `@electron/packager ^20.3.0` (currently 18.4.4).
- `@electron-forge/plugin-fuses` has a peer dependency `@electron/fuses ^2.1.3` (currently `^1.8.0`). Fuses 2 is ESM-only.
- `maker-dmg` still optionally depends on `electron-installer-dmg ^5.0.1` → `appdmg`. Its native modules (`macos-alias`, `fs-xattr`) still need npm 12 install-script approval. The upgrade does not change that.
- `maker-zip` dropped its `got` dependency. Our release relies on `macUpdateManifestBaseUrl` generating `RELEASES.json`, which must be re-verified.
- `maker-deb`/`maker-rpm` move to `electron-installer-debian`/`-redhat` 4.x. These are Linux-only and not built by the release.
- `plugin-vite` declares no peer dependency on Vite. Whether it supports Vite 5 must be confirmed (see Risks).

**Not verified:** the official Forge 8 release notes and migration guide. Starling's WebFetch allowlist blocks both `github.com/electron/forge` and `electronforge.io`. Before Task 2, either paste the "Forge 8 breaking changes" section into the session or get `electronforge.io` added to the allowlist. Treat every item under Risks as open until then.

## Global constraints

- Upgrade all `@electron-forge/*` packages together to the same exact minor; never mix 7.x and 8.x.
- Keep the lockfile diff limited to what the upgrade needs. Don't run unrelated `npm update`/`audit fix`.
- Signing identity (`G569HDEERH`, `com.electron.m-note`), fuses, `asar`, `CFBundleDocumentTypes` and the `update-darwin-<arch>.json` feed format must not change.
- `scripts/release.sh` and `scripts/validate-update-release.mjs` must pass unmodified, or any change to them must be justified.
- Don't approve npm install scripts on the user's behalf. List which ones are needed.

## Task 1: Baseline on a branch

- [ ] Create branch `chore/forge-8` from `main`.
- [ ] On the current Forge 7 tree (with the override), record a baseline: `npm ci`, `npm test`, `npm run lint`, `npx electron-forge package`. Run `npm run build:dmg` too if install scripts for `macos-alias`/`fs-xattr` are approved.
- [ ] Save `out/make/zip/darwin/<arch>/RELEASES.json`, `update.json` and the packaged `Info.plist` for comparison in Task 4.

## Task 2: Bump dependencies

- [ ] In `package.json` devDependencies, set every `@electron-forge/*` (`cli`, `maker-deb`, `maker-dmg`, `maker-rpm`, `maker-squirrel`, `maker-zip`, `plugin-auto-unpack-natives`, `plugin-fuses`, `plugin-vite`, `publisher-github`) to `^8.0.1`.
- [ ] Bump `@electron/fuses` to `^2.1.3`.
- [ ] Check `@electron/notarize` and `@electron/osx-sign` against what `@electron/packager@20` expects, using `npm view @electron/packager@20.3.0 dependencies`. Align or drop the direct deps if packager bundles them.
- [ ] Remove the `overrides` block for `@electron/node-gyp`.
- [ ] Run `npm install`. Confirm `grep -c 'git+' package-lock.json` reports no `resolved` git URLs, and `npm ls @electron/rebuild` shows 4.x only.
- [ ] Add a guard test in `src/__tests__/` that reads `package-lock.json` and fails if any `packages[*].resolved` starts with `git+`. This stops the `EALLOWGIT` regression from coming back silently.

## Task 3: Fix config for ESM Forge

- [ ] Run `npx electron-forge package` and fix errors as they come up. Expected areas:
  - **`forge.config.ts` loading.** Forge 8 is ESM. Confirm it still loads a TypeScript config. If it relies on Node's type stripping, `forge.config.ts` must not use TS-only syntax that stripping rejects (enums, namespaces, parameter properties). The current file only uses `import type` and `!`, both fine.
  - **`FuseV1Options`/`FuseVersion` imports** from `@electron/fuses` 2. Check whether the names or enum shape changed.
  - **`vite.renderer.config.ts` uses `__dirname`.** If Forge 8 loads Vite configs as ESM, replace it with `fileURLToPath(new URL('./src', import.meta.url))`.
  - **`tsconfig.json`** has `"module": "commonjs"`, `"moduleResolution": "node"`. This only affects type-checking of the configs, but `@electron/fuses` 2 and Forge 8 types may need `"moduleResolution": "bundler"` to resolve their `exports`. Change it only if `tsc --noEmit` fails.
- [ ] Confirm `"main": ".vite/build/main.js"` still matches the Vite plugin's output path.
- [ ] `npm start`: the app launches, HMR works, a `.md` file opens via CLI arg.

## Task 4: Verify packaging and release artifacts

- [ ] `npx electron-forge make` on macOS. Compare with the Task 1 baseline:
  - The ZIP name still matches `*-darwin-<arch>-<version>.zip`.
  - `RELEASES.json` is still generated from `macUpdateManifestBaseUrl`, and `node scripts/fix-mac-update-manifest.mjs` still produces `update.json`/`update-darwin-<arch>.json`.
  - `node scripts/validate-update-release.mjs <staging> <version> <arch> <team> <bundleId>` passes.
  - `Info.plist` still has the bundle ID, version and Markdown document types.
  - `codesign --verify --deep --strict` and `spctl --assess --type execute` pass, and notarisation succeeds with the `m-note` keychain profile.
  - Fuses are unchanged: `npx @electron/fuses read --app <path>.app`.
- [ ] `npm run build:dmg` produces a mountable ULFO DMG.
- [ ] `npm test`, `npm run lint`, `npx tsc --noEmit`.

## Task 5: Verify a real native update

- [ ] Follow `docs/testing/native-updates.md`: install the current public release, publish the Forge 8 build as a draft or test release, and confirm the installed app downloads, restarts and relaunches on the new version. This checks that Squirrel.Mac accepts the ZIP Forge 8 produces.

## Risks

- **Vite version.** `plugin-vite@8` may require Vite 6+ or change the build/renderer config shape. If so, upgrading `vite`, `@vitejs/plugin-react` and possibly `vitest` is a separate step that needs its own testing. Don't fold it in silently.
- **Packager 18 → 20.** Option names for `osxSign`/`osxNotarize`, or the `ignore` callback signature, may have changed. Notarisation failures only show up on a real `make`.
- **`macUpdateManifestBaseUrl` removed or renamed in `maker-zip@8`.** That would break `release.sh`. The fallback is to generate the flat feed in `fix-mac-update-manifest.mjs` from the ZIP name alone.
- **npm 12 install scripts.** Still needed for DMG builds after the upgrade. `npm install-scripts approve macos-alias fs-xattr` (and `fsevents` if `npm start` file watching degrades) remains the user's decision.
- **Rollback:** revert the branch. Forge 7 plus the `@electron/node-gyp` override on `main` stays a working fallback.

## Acceptance criteria

- `npm ci` succeeds on npm 12 with `allow-git=none` and no `overrides`.
- No `git+` `resolved` entries in `package-lock.json`, enforced by a test.
- Tests, lint and typecheck pass. `npm start` works.
- `make` produces a signed, notarised ZIP and DMG that pass `validate-update-release.mjs` unchanged.
- An installed previous release updates natively to the Forge 8 build.

## Information sources

- npm registry metadata for `@electron-forge/*@8.0.1` and `7.11.2`, `@electron/rebuild@4.2.1` and `@electron/fuses@2.1.3`, via `npm view`.
- Not consulted (blocked by the WebFetch allowlist): Forge 8 release notes on GitHub, electronforge.io migration docs.

## Implementation record (2026-10-29)

Branch `chore/forge-8`. Tasks 2–3 done; Tasks 1, 4 and 5 not started.

- All `@electron-forge/*` → 8.0.1, `@electron/fuses` → 2.1.3, `@electron/node-gyp` override removed. Tree now resolves `@electron/rebuild@4.2.1` → `node-gyp@12.4.0` and `@electron/packager@20.3.0`. No other direct dependency moved.
- `src/__tests__/package-lock.test.ts` fails on the Forge 7 lockfile (`node_modules/@electron/node-gyp`) and passes now.
- Breaking changes hit:
  - `PublisherGithub` renamed to `PublisherGitHub`.
  - Forge 8 and `@electron/fuses` 2 types need `"moduleResolution": "bundler"` (with `"module": "ESNext"`) in `tsconfig.json`.
  - The Vite plugin emits `.cjs`: `package.json` `main` is now `.vite/build/main.cjs`, and `src/main.ts` loads `preload.cjs`. Forge fails `start` with an explicit message otherwise.
- `forge.config.ts` loads unchanged under ESM Forge. The `__dirname` in `vite.renderer.config.ts` still works.
- **Vite:** `plugin-vite@8` is developed against Vite 8 and sets the Rolldown-only `output.codeSplitting: false` for preload. Vite 5 warns `Unknown output options: codeSplitting` and ignores it. Harmless while preload has no dynamic imports, but Vite 5 → 8 should be a follow-up.
- Verified: clean `npm ci` on npm 12 with `allow-git=none`, `tsc --noEmit`, 152 tests, lint (0 errors), and `npm start` builds and launches Electron with no errors in the log. Not visually confirmed.
- Not run: `electron-forge package`/`make`. Both sign and submit to Apple notarisation (`osxNotarize` is always configured). The DMG maker also needs `macos-alias`/`fs-xattr` install scripts approved under npm 12.
