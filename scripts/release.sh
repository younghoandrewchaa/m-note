#!/usr/bin/env bash
set -euo pipefail
trap 'echo "Error: script failed at line $LINENO" >&2' ERR

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

RELEASE_NOTE="${1:-}"

# --- Require clean working tree ---
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree has uncommitted changes. Commit or stash them first."
  exit 1
fi

# --- Bump patch version ---
NEW_VERSION=$(npm version patch --no-git-tag-version | sed 's/^v//')
echo "==> Version bumped to $NEW_VERSION"

# --- Commit and tag ---
git add package.json package-lock.json
git commit -m "v${NEW_VERSION}"

if [ -n "$RELEASE_NOTE" ]; then
  git tag -a "v${NEW_VERSION}" -m "$RELEASE_NOTE"
else
  git tag "v${NEW_VERSION}"
fi
echo "==> Created commit and tag v${NEW_VERSION}"

# --- Push to remote (triggers CI build + publish) ---
echo "==> Pushing to remote..."
git push
git push --tags

echo ""
echo "Released v${NEW_VERSION} — CI will build, sign, and publish the DMG."
