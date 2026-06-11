import { describe, expect, it } from 'vitest';
import {
  normalizeManifest,
  normalizeZipName,
} from '../../scripts/fix-mac-update-manifest.mjs';

describe('mac update manifest normalization', () => {
  it('replaces spaces in the zip filename with dots (matching GitHub asset naming)', () => {
    expect(normalizeZipName('M Note-darwin-arm64-1.1.15.zip')).toBe(
      'M.Note-darwin-arm64-1.1.15.zip',
    );
  });

  it('rewrites the current release url so its last segment matches the uploaded asset', () => {
    const manifest = {
      currentRelease: '1.1.15',
      releases: [
        {
          version: '1.1.15',
          updateTo: {
            name: 'M Note v1.1.15',
            version: '1.1.15',
            pub_date: '2026-06-11T00:00:00.000Z',
            // maker-zip URL-encodes the space in "M Note" -> %20
            url: 'https://github.com/younghoandrewchaa/m-note/releases/latest/download/M%20Note-darwin-arm64-1.1.15.zip',
            notes: '',
          },
        },
      ],
    };

    const normalizedName = normalizeZipName('M Note-darwin-arm64-1.1.15.zip');
    const result = normalizeManifest(manifest, normalizedName);

    const url = result.releases[0].updateTo.url;
    expect(url.endsWith(`/${normalizedName}`)).toBe(true);
    expect(url).not.toContain('%20');
    expect(url).not.toContain(' ');
    expect(url).toBe(
      'https://github.com/younghoandrewchaa/m-note/releases/latest/download/M.Note-darwin-arm64-1.1.15.zip',
    );
  });

  it('only rewrites the entry matching currentRelease, leaving prior releases untouched', () => {
    const previousUrl =
      'https://github.com/younghoandrewchaa/m-note/releases/latest/download/M.Note-darwin-arm64-1.1.14.zip';
    const manifest = {
      currentRelease: '1.1.15',
      releases: [
        {
          version: '1.1.14',
          updateTo: { version: '1.1.14', url: previousUrl },
        },
        {
          version: '1.1.15',
          updateTo: {
            version: '1.1.15',
            url: 'https://github.com/younghoandrewchaa/m-note/releases/latest/download/M%20Note-darwin-arm64-1.1.15.zip',
          },
        },
      ],
    };

    const result = normalizeManifest(manifest, 'M.Note-darwin-arm64-1.1.15.zip');

    expect(result.releases[0].updateTo.url).toBe(previousUrl);
    expect(result.releases[1].updateTo.url).toBe(
      'https://github.com/younghoandrewchaa/m-note/releases/latest/download/M.Note-darwin-arm64-1.1.15.zip',
    );
  });
});
