#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"

DMG_PATH=$(find out/make -name "*.dmg" -maxdepth 3 | head -1)
if [ -z "$DMG_PATH" ]; then
  echo "Error: DMG not found in out/make/"
  exit 1
fi

echo "==> Pushing tag $TAG..."
git push
git push --tags

echo "==> Creating GitHub release $TAG..."
PREV_TAG=$(git describe --tags --abbrev=0 "${TAG}^" 2>/dev/null || echo "")
if [ -n "$PREV_TAG" ]; then
  NOTES=$(git log "$PREV_TAG".."$TAG" --no-merges --invert-grep --grep='^v[0-9]' --format='- %s')
else
  NOTES=$(git log "$TAG" --no-merges --invert-grep --grep='^v[0-9]' --format='- %s')
fi
gh release create "$TAG" "$DMG_PATH" \
  --title "M Note $TAG" \
  --notes "$NOTES"

echo "==> Released: $(gh release view "$TAG" --json url -q .url)"
