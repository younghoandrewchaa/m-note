import { describe, expect, it } from 'vitest'
import {
  normalizeManifest,
  normalizeZipName,
  toSquirrelMacFeed,
} from '../../scripts/fix-mac-update-manifest.mjs'

describe('mac update manifest normalization', () => {
  it('replaces spaces in the zip filename with dots (matching GitHub asset naming)', () => {
    expect(normalizeZipName('M Note-darwin-arm64-1.1.15.zip')).toBe(
      'M.Note-darwin-arm64-1.1.15.zip',
    )
  })

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
    }

    const normalizedName = normalizeZipName('M Note-darwin-arm64-1.1.15.zip')
    const result = normalizeManifest(manifest, normalizedName)

    const url = result.releases[0].updateTo.url
    expect(url.endsWith(`/${normalizedName}`)).toBe(true)
    expect(url).not.toContain('%20')
    expect(url).not.toContain(' ')
    expect(url).toBe(
      'https://github.com/younghoandrewchaa/m-note/releases/latest/download/M.Note-darwin-arm64-1.1.15.zip',
    )
  })

  it('only rewrites the entry matching currentRelease, leaving prior releases untouched', () => {
    const previousUrl =
      'https://github.com/younghoandrewchaa/m-note/releases/latest/download/M.Note-darwin-arm64-1.1.14.zip'
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
    }

    const result = normalizeManifest(manifest, 'M.Note-darwin-arm64-1.1.15.zip')

    expect(result.releases[0].updateTo.url).toBe(previousUrl)
    expect(result.releases[1].updateTo.url).toBe(
      'https://github.com/younghoandrewchaa/m-note/releases/latest/download/M.Note-darwin-arm64-1.1.15.zip',
    )
  })
})

describe('Squirrel.Mac feed extraction', () => {
  // Squirrel.Mac's JSON server type expects a flat { url, name, notes, pub_date }
  // object at the feed URL (see the Squirrel.Mac README linked from Electron's
  // FeedURLOptions docs) — not the { currentRelease, releases: [...] } manifest
  // maker-zip produces. Serving the manifest shape directly means Squirrel.Mac
  // can never find an update to install.
  it('flattens the currentRelease entry into the shape Squirrel.Mac expects', () => {
    const manifest = {
      currentRelease: '1.1.20',
      releases: [
        {
          version: '1.1.19',
          updateTo: {
            name: 'M Note v1.1.19',
            version: '1.1.19',
            pub_date: '2026-06-01T00:00:00.000Z',
            url: 'https://github.com/younghoandrewchaa/m-note/releases/latest/download/M.Note-darwin-arm64-1.1.19.zip',
            notes: '',
          },
        },
        {
          version: '1.1.20',
          updateTo: {
            name: 'M Note v1.1.20',
            version: '1.1.20',
            pub_date: '2026-07-01T00:00:00.000Z',
            url: 'https://github.com/younghoandrewchaa/m-note/releases/latest/download/M.Note-darwin-arm64-1.1.20.zip',
            notes: 'Bug fixes',
          },
        },
      ],
    }

    expect(toSquirrelMacFeed(manifest)).toEqual({
      url: 'https://github.com/younghoandrewchaa/m-note/releases/latest/download/M.Note-darwin-arm64-1.1.20.zip',
      name: 'M Note v1.1.20',
      notes: 'Bug fixes',
      pub_date: '2026-07-01T00:00:00.000Z',
    })
  })

  it('throws when no release entry matches currentRelease', () => {
    const manifest = { currentRelease: '9.9.9', releases: [] }
    expect(() => toSquirrelMacFeed(manifest)).toThrow()
  })
})
