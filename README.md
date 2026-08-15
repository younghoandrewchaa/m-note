

# M Note

A markdown editor built with Electron, React, and Tiptap.

![M Note](m-note-screenshot.png)

## Download

Download the latest release from the [GitHub Releases](https://github.com/younghoandrewchaa/m-note/releases) page.

- **macOS** — download the `.dmg` file
- **Windows** — download the `.exe` setup file

### Windows: SmartScreen warning

The Windows installer is not code-signed yet, so Windows SmartScreen may show a warning on first launch. To proceed:

1. Click **"More info"**
2. Click **"Run anyway"**

## Development

```bash
npm start
```

## Scripts

### Release

```bash
npm run release
# or with a custom release note:
npm run release -- "What's new in this release"
```

Requires a clean working tree.

Runs locally and triggers CI to build and publish:

1. **Preflight** — checks there are no uncommitted changes
2. **Version bump** — increments the patch number in `package.json` / `package-lock.json`
3. **Commit & tag** — commits the version files and creates a `vX.Y.Z` git tag
4. **Push** — pushes the commit and tag to remote, which triggers the CI workflow
5. **CI** — builds the signed/notarized DMG and publishes the GitHub release

If a release note is passed, it becomes the GitHub release body verbatim. Otherwise CI auto-generates notes from the git commit log since the previous tag.

### Build DMG (local only)

```bash
npm run build:dmg
```

Builds the DMG without bumping the version or publishing. Useful for local testing.

### Test

```bash
npm test
```

Runs the unit tests via Vitest.
