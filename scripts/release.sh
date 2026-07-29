#!/usr/bin/env bash
#
# Local release pipeline for M Note.
#
# Builds a signed + notarised DMG and creates the GitHub release entirely on
# this machine — no CI required. The flow is idempotent: it keys everything off
# the current package.json version, and every step checks whether its output
# already exists before doing the work. So if a run fails partway through, just
# run it again (without changing the version) and it picks up where it left off.
#
# To ship a NEW release, bump the version first (e.g. `npm version patch
# --no-git-tag-version`), commit it, then run this.
#
# Usage:
#   npm run release                 # prompts for the release statement
#   npm run release -- "My notes"   # pass the release statement non-interactively
#   SKIP_TESTS=1 npm run release    # skip the test run
#
set -uo pipefail
trap 'echo "Error: script failed at line $LINENO" >&2' ERR

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

# --- Resolve version ---
VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"
RELEASE_NOTE="${1:-}"

echo "==> Releasing ${TAG}"

# --- Short-circuit if already fully released ---
# A complete macOS release needs four assets: the DMG (manual download), the
# .zip (what native auto-update actually downloads and installs), RELEASES.json
# (bookkeeping maker-zip needs across runs), and update.json (the flat feed
# Squirrel.Mac reads to decide there's an update). If any is missing (e.g. a
# prior DMG-only run), fall through and finish the upload.
release_exists() { gh release view "$TAG" >/dev/null 2>&1; }
release_assets() { gh release view "$TAG" --json assets -q '.assets[].name' 2>/dev/null; }
fully_released() {
  local assets
  assets=$(release_assets) || return 1
  echo "$assets" | grep -qi '\.dmg$' \
    && echo "$assets" | grep -qi '\.zip$' \
    && echo "$assets" | grep -qx 'RELEASES.json' \
    && echo "$assets" | grep -qx 'update.json'
}

if release_exists && fully_released; then
  echo "==> ${TAG} is already released with DMG, ZIP, RELEASES.json, and update.json attached. Nothing to do."
  echo "    Bump the version (npm version patch) to ship a new release."
  exit 0
fi

# --- Run tests (mirrors the CI gate) ---
if [ "${SKIP_TESTS:-}" = "1" ]; then
  echo "==> Skipping tests (SKIP_TESTS=1)"
else
  echo "==> Running tests..."
  npm test
fi

# --- Get the release statement ---
# Only needed when the release does not yet exist; otherwise reuse the notes
# already on the GitHub release.
if ! release_exists; then
  if [ -z "$RELEASE_NOTE" ]; then
    echo ""
    read -rp "Release statement for ${TAG}: " RELEASE_NOTE
  fi
fi

# --- Build DMG + update ZIP (skip only if both DMG and manifest already exist) ---
# The DMG is the manual download; the maker-zip target produces the signed .zip
# plus a RELEASES.json manifest (because forge.config.ts sets
# macUpdateManifestBaseUrl) that Squirrel.Mac native auto-update fetches.
#
# Run `make` with NO --targets: passing --targets makes electron-forge resolve
# makers by name and fall back to a default instance on a miss, bypassing the
# configured MakerZIP (and its macUpdateManifestBaseUrl) so no RELEASES.json is
# produced. A plain `make` uses the configured makers; on darwin only DMG + ZIP
# apply, so this yields DMG + ZIP + RELEASES.json.
DMG_PATH=$(find out/make -maxdepth 3 -name "*${VERSION}*.dmg" 2>/dev/null | head -1)
EXISTING_MANIFEST=$(find out/make/zip -maxdepth 4 -name 'RELEASES.json' 2>/dev/null | head -1)

if [ -n "$DMG_PATH" ] && [ -n "$EXISTING_MANIFEST" ]; then
  echo "==> DMG and RELEASES.json already built (skipping build)"
else
  if [ ! -f resources/icon.icns ]; then
    echo "==> Generating icon..."
    sh scripts/generate-icon.sh
  fi

  echo "==> Building signed + notarised DMG and update ZIP for ${TAG}..."
  rm -rf out/
  npx electron-forge make

  DMG_PATH=$(find out/make -maxdepth 3 -name "*${VERSION}*.dmg" 2>/dev/null | head -1)
  if [ -z "$DMG_PATH" ]; then
    echo "Error: DMG not found in out/make/ after build." >&2
    exit 1
  fi
  echo "==> DMG built: $DMG_PATH"
fi

# --- Locate + normalize the update ZIP and RELEASES.json manifest ---
# maker-zip names the zip after the app dir ("M Note-darwin-...zip", with a
# space) and points the manifest at the URL-encoded name. GitHub serves uploaded
# assets with spaces replaced by dots, so the manifest URL would 404. The helper
# renames the zip and rewrites the manifest URL to the same dot-normalized name.
ZIP_PATH=$(find out/make/zip -maxdepth 4 -name "*${VERSION}*.zip" 2>/dev/null | head -1)
RELEASES_JSON=$(find out/make/zip -maxdepth 4 -name 'RELEASES.json' 2>/dev/null | head -1)
if [ -z "$ZIP_PATH" ] || [ -z "$RELEASES_JSON" ]; then
  echo "Error: update ZIP or RELEASES.json not found under out/make/zip/." >&2
  echo "       (Remove out/ and re-run so the maker-zip target builds them.)" >&2
  exit 1
fi

ZIP_PATH=$(node scripts/fix-mac-update-manifest.mjs "$RELEASES_JSON" "$ZIP_PATH")
UPDATE_JSON="$(dirname "$RELEASES_JSON")/update.json"
echo "==> Update ZIP: $ZIP_PATH"
echo "==> Manifest:   $RELEASES_JSON"
echo "==> Feed:       $UPDATE_JSON"

# --- Tag ---
if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  echo "==> Tag ${TAG} already exists (skipping)"
else
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Warning: working tree has uncommitted changes; tagging current HEAD anyway." >&2
  fi
  if [ -n "$RELEASE_NOTE" ]; then
    git tag -a "$TAG" -m "$RELEASE_NOTE"
  else
    git tag "$TAG"
  fi
  echo "==> Created tag ${TAG}"
fi

# --- Push (no-ops if already up to date) ---
echo "==> Pushing commits and tag..."
git push
git push origin "$TAG"

# --- GitHub release ---
# Upload all four assets: DMG (manual download), ZIP (native auto-update
# payload), RELEASES.json (bookkeeping), and update.json (the flat feed
# Squirrel.Mac fetches). update.json must be served verbatim at
# releases/latest/download/update.json for the Squirrel.Mac feed URL to resolve.
if release_exists; then
  echo "==> Release ${TAG} exists; uploading DMG, ZIP, RELEASES.json, and update.json..."
  gh release upload "$TAG" "$DMG_PATH" "$ZIP_PATH" "$RELEASES_JSON" "$UPDATE_JSON" --clobber
  if [ -n "$RELEASE_NOTE" ]; then
    gh release edit "$TAG" --notes "$RELEASE_NOTE"
  fi
else
  echo "==> Creating GitHub release ${TAG}..."
  gh release create "$TAG" "$DMG_PATH" "$ZIP_PATH" "$RELEASES_JSON" "$UPDATE_JSON" --title "$TAG" --notes "$RELEASE_NOTE"
fi

echo ""
echo "Released ${TAG}: $(gh release view "$TAG" --json url -q .url 2>/dev/null)"
