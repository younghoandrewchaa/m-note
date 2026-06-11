#!/usr/bin/env node
//
// Normalize a Squirrel.Mac `RELEASES.json` so its update URL matches the zip
// asset name that GitHub will actually serve.
//
// @electron-forge/maker-zip names the mac update zip after the packaged app
// directory, e.g. "M Note-darwin-arm64-1.1.15.zip" (note the space), and writes
// the manifest `updateTo.url` as ".../download/M%20Note-...zip". When the zip is
// uploaded as a GitHub release asset, GitHub replaces spaces with dots, so the
// served asset is "M.Note-darwin-arm64-1.1.15.zip". The manifest URL then 404s
// and native auto-update silently fails. This rewrites both sides to the same
// dot-normalized name.
//
// Usage (from release.sh):
//   node scripts/fix-mac-update-manifest.mjs <RELEASES.json> <zip path>
// Renames the zip on disk, rewrites the manifest in place, and prints the
// normalized zip path to stdout.

import fs from 'node:fs';
import path from 'node:path';

/** GitHub replaces spaces in release asset filenames with dots. Mirror that. */
export function normalizeZipName(name) {
  return name.replace(/ /g, '.');
}

/**
 * Rewrite the `updateTo.url` of the entry matching `currentRelease` so its final
 * path segment equals `normalizedZipName`. Prior releases are left untouched —
 * they were normalized when they were published.
 */
export function normalizeManifest(manifest, normalizedZipName) {
  const releases = (manifest.releases ?? []).map((release) => {
    if (release.version !== manifest.currentRelease) return release;
    if (!release.updateTo?.url) return release;

    const url = new URL(release.updateTo.url);
    const segments = url.pathname.split('/');
    segments[segments.length - 1] = normalizedZipName;
    url.pathname = segments.join('/');

    return {
      ...release,
      updateTo: { ...release.updateTo, url: url.toString() },
    };
  });

  return { ...manifest, releases };
}

function main(argv) {
  const [manifestPath, zipPath] = argv;
  if (!manifestPath || !zipPath) {
    console.error(
      'Usage: fix-mac-update-manifest.mjs <RELEASES.json> <zip path>',
    );
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const normalizedName = normalizeZipName(path.basename(zipPath));

  const normalized = normalizeManifest(manifest, normalizedName);
  fs.writeFileSync(manifestPath, JSON.stringify(normalized));

  const normalizedZipPath = path.join(path.dirname(zipPath), normalizedName);
  if (normalizedZipPath !== zipPath) {
    fs.renameSync(zipPath, normalizedZipPath);
  }

  // Emit the final zip path so the caller can upload it.
  process.stdout.write(normalizedZipPath);
}

// Run only when invoked as a script, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}
