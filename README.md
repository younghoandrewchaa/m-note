# M Note

A macOS markdown editor built with Electron, React, and Tiptap.

![M Note](m-note-screenshot.png)

## Download

Download the macOS ZIP for your Mac from the [latest GitHub release](https://github.com/younghoandrewchaa/m-note/releases/latest). Unzip it and move **M Note.app** to Applications.

## Features

- **Rich-text Markdown editing** powered by [`@younghoandrewchaa/yeditor`](packages/yeditor/README.md) — YAML frontmatter blocks, tables, task lists, syntax-highlighted code blocks, Mermaid diagram previews, in-document search, copy markdown, copy file path, and light/dark themes.
- **Native macOS tabs** — open `.md`/`.markdown` files from Finder, drag-and-drop, CLI arguments, or local Markdown links in native tabs (`Cmd+N` / `Cmd+T` for a new tab, `Cmd+W` to close, `Cmd+Shift+[` / `Cmd+Shift+]` to switch tabs). Already-open files focus their existing tab, untitled tabs prompt for a Save As location, unsaved tabs show a `●` prefix, and closing or quitting prompts to save dirty tabs.

## Mermaid diagrams

Choose **Mermaid** in a code block's language selector, or open Markdown containing a Mermaid fence:

````markdown
```mermaid
flowchart LR
  Draft --> Review --> Published
```
````

The source stays editable with a live diagram below it. Previews update after a short typing pause, match the light/dark theme, and work offline. Saving or choosing **Copy as… → Copy as Markdown** preserves the original Mermaid source.

Invalid or oversized diagrams show an error without discarding source. If an earlier valid preview remains visible, it is marked as stale. Diagram links and external images are disabled.

Rendering uses [Pele](https://pele.run/), whose layout differs from Mermaid.js. Mermaid theme colours, arbitrary HTML labels, and external Mermaid plugins are not supported; see [Pele's compatibility guide](https://pele.run/compatibility).

## App updates

Installed macOS builds check for updates automatically when the app launches. Click **Check for Updates** in the toolbar to check again. Available updates download inside the app; choose **Restart & Install** when ready. Unsaved notes are handled before the app closes, and open tabs (along with the active tab) are restored after restarting. If a check or download fails, use **Retry** or the toolbar icon. The app does not offer manual download links.

See [native update verification](docs/testing/native-updates.md) for the required installed-app acceptance test.

## Development

```bash
npm start   # Launch the Electron app with Vite HMR
npm test    # Run all tests (app + @younghoandrewchaa/yeditor)
npm run lint
```

The reusable React editor lives in the [`packages/yeditor`](packages/yeditor/README.md) workspace package (`@younghoandrewchaa/yeditor`).

## Scripts

### Release

Bump the version first if needed (`npm run patch` increments the patch version in `package.json` / `package-lock.json`), then run:

```bash
npm run release
# or with a custom release note:
npm run release -- "What's new in this release"
```

Releases run locally on macOS with Node.js 22 or newer. The job runs the tests and production build, then uses `electron-mac-release` to package, sign, and notarize the app. Its packaging options live in the `macRelease` block of `package.json`.

Set `APPLE_KEYCHAIN_PROFILE` to use your stored `notarytool` profile. The default is `app-signing-profile`. If `APPLE_ID` is set, set `APPLE_TEAM_ID` and either `APPLE_APP_SPECIFIC_PASSWORD` or `APPLE_ID_PASSWORD` in the same environment. Set `APPLE_SIGN_IDENTITY` if you need to select a particular Developer ID certificate.

The release job verifies the signed ZIP and creates a nested update feed with top-level download metadata for older M Note versions. It uploads the ZIP and feeds to a draft GitHub release, verifies the uploaded files, and publishes the release. Run `npm run package` to build an ad hoc signed bundle for local testing.

### Build DMG (local only)

```bash
npm run build:dmg
```

Builds the macOS DMG without publishing. Useful for local testing.

## License

[MIT](LICENSE)
