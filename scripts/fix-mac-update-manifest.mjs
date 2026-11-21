#!/usr/bin/env node
//
// Keep top-level metadata in the nested feed for older M Note clients.
// Use a dot-normalized ZIP name to match the URL GitHub serves.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildManifest } from 'electron-mac-release/lib/manifest.mjs';
import { loadConfig } from 'electron-mac-release/lib/config.mjs';

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
    url.pathname = segments.join('/').replace('/releases/latest/download/', `/releases/download/v${manifest.currentRelease}/`);

    return {
      ...release,
      updateTo: { ...release.updateTo, url: url.toString() },
    };
  });

  return { ...manifest, releases };
}

/**
 * Read the current release's download metadata for older M Note clients.
 */
export function toSquirrelMacFeed(manifest) {
  const release = (manifest.releases ?? []).find(
    (r) => r.version === manifest.currentRelease,
  );
  if (!release?.updateTo) {
    throw new Error(
      `No release entry found for currentRelease ${manifest.currentRelease}`,
    );
  }

  const { url, name, notes, pub_date } = release.updateTo;
  return { url, name, notes, pub_date };
}

function main(argv) {
  const [zipPath, version, notes] = argv;
  if (!zipPath || !version || notes === undefined)
    throw new Error('Usage: fix-mac-update-manifest.mjs <zip path> <version> <notes>');

  const zipName = path.basename(zipPath);
  const match = zipName.match(/-darwin-(arm64|x64)-([0-9.]+)\.zip$/);
  if (!match || match[2] !== version || zipName !== normalizeZipName(zipName))
    throw new Error('ZIP name does not match the release version and architecture');

  const manifest = buildManifest({
    name: loadConfig().name,
    version,
    repository: 'younghoandrewchaa/m-note',
    zipName,
    notes,
  });
  const directory = path.dirname(zipPath);
  fs.writeFileSync(path.join(directory, 'RELEASES.json'), JSON.stringify(manifest));
  const metadata = toSquirrelMacFeed(manifest);
  fs.writeFileSync(path.join(directory, 'update.json'), JSON.stringify(metadata));
  fs.writeFileSync(
    path.join(directory, `update-darwin-${match[1]}.json`),
    JSON.stringify({ ...manifest, ...metadata }),
  );
}

// Run only when invoked as a script, not when imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
