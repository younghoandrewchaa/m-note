#!/usr/bin/env bash
# Build locally or in CI; validate and upload a draft before publishing.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=$(node -p "require('./package.json').version")
ARCH=$(node -p 'process.arch')
APP_NAME=$(node -p "require('./package.json').productName")
TAG="v${VERSION}"
RELEASE_NOTE="${1:-}"
if gh release view "$TAG" --json isDraft -q '.isDraft' > /dev/null 2>&1; then
  if [ "$(gh release view "$TAG" --json isDraft -q '.isDraft')" != true ]; then
    echo "Release $TAG is already public; bump the version to publish new binaries."
    exit 0
  fi
fi
npm test
if [ -z "$RELEASE_NOTE" ]; then read -rp 'Release statement: ' RELEASE_NOTE; fi
if [ ! -f resources/icon.icns ]; then sh scripts/generate-icon.sh; fi
npm run package -- --sign
STAGING=$(mktemp -d)
trap 'rm -rf "$STAGING"' EXIT
PACKAGED_APP="out/${APP_NAME}-darwin-${ARCH}/${APP_NAME}.app"
ZIP_PATH="$STAGING/${APP_NAME// /.}-darwin-${ARCH}-${VERSION}.zip"
ditto -c -k --sequesterRsrc --keepParent "$PACKAGED_APP" "$ZIP_PATH"
node scripts/fix-mac-update-manifest.mjs "$ZIP_PATH" "$VERSION" "$RELEASE_NOTE"
node scripts/validate-update-release.mjs "$STAGING" "$VERSION" "$ARCH"
# Verify the actual ZIP payload, not just the surrounding metadata.
ditto -x -k "$ZIP_PATH" "$STAGING/unpacked"
APP_PATH=$(find "$STAGING/unpacked" -maxdepth 1 -name '*.app' -print -quit)
[ -n "$APP_PATH" ]
[ "$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$APP_PATH/Contents/Info.plist")" = "$VERSION" ]
EXECUTABLE=$(/usr/libexec/PlistBuddy -c 'Print CFBundleExecutable' "$APP_PATH/Contents/Info.plist")
MACH_ARCH="$ARCH"
if [ "$ARCH" = x64 ]; then MACH_ARCH=x86_64; fi
lipo "$APP_PATH/Contents/MacOS/$EXECUTABLE" -verify_arch "$MACH_ARCH"
codesign --verify --deep --strict "$APP_PATH"
xcrun stapler validate "$APP_PATH"
TEAM=$(codesign -dv "$APP_PATH" 2>&1 | sed -n 's/^TeamIdentifier=//p')
BUNDLE_ID=$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$APP_PATH/Contents/Info.plist")
node scripts/validate-update-release.mjs "$STAGING" "$VERSION" "$ARCH" "$TEAM" "$BUNDLE_ID"
spctl --assess --type execute "$APP_PATH"
if ! git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then git tag -a "$TAG" -m "$RELEASE_NOTE"; fi
git push origin "$TAG"
if ! gh release view "$TAG" >/dev/null 2>&1; then
  gh release create "$TAG" --draft --title "$TAG" --notes "$RELEASE_NOTE"
fi
gh release upload "$TAG" "$ZIP_PATH" "$STAGING"/*.json --clobber
mkdir "$STAGING/downloaded"
gh release download "$TAG" --dir "$STAGING/downloaded"
node scripts/validate-update-release.mjs "$STAGING/downloaded" "$VERSION" "$ARCH"
# The uploaded ZIP must be the exact signed payload validated above.
cmp "$ZIP_PATH" "$STAGING/downloaded/$(basename "$ZIP_PATH")"
gh release edit "$TAG" --draft=false --latest --notes "$RELEASE_NOTE"
echo "Released $TAG"
