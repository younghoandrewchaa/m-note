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
release_exists() { gh release view "$TAG" >/dev/null 2>&1; }
dmg_asset_attached() {
  gh release view "$TAG" --json assets -q '.assets[].name' 2>/dev/null \
    | grep -qi '\.dmg$'
}

if release_exists && dmg_asset_attached; then
  echo "==> ${TAG} is already released with a DMG attached. Nothing to do."
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

# --- Build DMG (skip if one already exists for this version) ---
DMG_PATH=$(find out/make -maxdepth 3 -name "*${VERSION}*.dmg" 2>/dev/null | head -1)

if [ -n "$DMG_PATH" ]; then
  echo "==> DMG already built: $DMG_PATH (skipping build)"
else
  if [ ! -f resources/icon.icns ]; then
    echo "==> Generating icon..."
    sh scripts/generate-icon.sh
  fi

  echo "==> Building signed + notarised DMG for ${TAG}..."
  rm -rf out/
  npx electron-forge make --targets @electron-forge/maker-dmg

  DMG_PATH=$(find out/make -maxdepth 3 -name "*${VERSION}*.dmg" 2>/dev/null | head -1)
  if [ -z "$DMG_PATH" ]; then
    echo "Error: DMG not found in out/make/ after build." >&2
    exit 1
  fi
  echo "==> DMG built: $DMG_PATH"
fi

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
if release_exists; then
  echo "==> Release ${TAG} exists; uploading DMG..."
  gh release upload "$TAG" "$DMG_PATH" --clobber
  if [ -n "$RELEASE_NOTE" ]; then
    gh release edit "$TAG" --notes "$RELEASE_NOTE"
  fi
else
  echo "==> Creating GitHub release ${TAG}..."
  gh release create "$TAG" "$DMG_PATH" --title "$TAG" --notes "$RELEASE_NOTE"
fi

echo ""
echo "Released ${TAG}: $(gh release view "$TAG" --json url -q .url 2>/dev/null)"
