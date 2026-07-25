import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFetch = vi.fn()
const mockGetVersion = vi.fn(() => '1.0.0')

vi.mock('electron', () => ({
  app: { getVersion: () => mockGetVersion() },
  net: { fetch: (...args: unknown[]) => mockFetch(...args) },
}))

function makeRelease(version: string, assets: Array<{ name: string; browser_download_url: string }>) {
  return {
    ok: true,
    json: () => Promise.resolve({ tag_name: `v${version}`, assets }),
  }
}

const DMG_ASSET = { name: 'M Note.dmg', browser_download_url: 'https://example.com/MNote.dmg' }
const EXE_ASSET = { name: 'M Note-1.1.0 Setup.exe', browser_download_url: 'https://example.com/Setup.exe' }

describe('checkForUpdate — platform-aware asset selection', () => {
  let originalPlatform: PropertyDescriptor | undefined

  beforeEach(() => {
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
  })

  afterEach(() => {
    mockFetch.mockReset()
    mockGetVersion.mockReturnValue('1.0.0')
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform)
    }
  })

  it('returns dmg download url on darwin when a newer version exists', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    mockFetch.mockResolvedValue(makeRelease('1.1.0', [DMG_ASSET, EXE_ASSET]))

    const { checkForUpdate } = await import('../update-checker')
    const result = await checkForUpdate()

    expect(result?.downloadUrl).toBe(DMG_ASSET.browser_download_url)
    expect(result?.version).toBe('1.1.0')
  })

  it('returns setup exe download url on win32 when a newer version exists', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    mockFetch.mockResolvedValue(makeRelease('1.1.0', [DMG_ASSET, EXE_ASSET]))

    const { checkForUpdate } = await import('../update-checker')
    const result = await checkForUpdate()

    expect(result?.downloadUrl).toBe(EXE_ASSET.browser_download_url)
    expect(result?.version).toBe('1.1.0')
  })

  it('returns null on darwin when release has no dmg asset', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    mockFetch.mockResolvedValue(makeRelease('1.1.0', [EXE_ASSET]))

    const { checkForUpdate } = await import('../update-checker')
    const result = await checkForUpdate()

    expect(result).toBeNull()
  })

  it('returns null on win32 when release has no setup exe asset', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    mockFetch.mockResolvedValue(makeRelease('1.1.0', [DMG_ASSET]))

    const { checkForUpdate } = await import('../update-checker')
    const result = await checkForUpdate()

    expect(result).toBeNull()
  })

  it('returns null when current version is up to date', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    mockGetVersion.mockReturnValue('1.1.0')
    mockFetch.mockResolvedValue(makeRelease('1.1.0', [DMG_ASSET]))

    const { checkForUpdate } = await import('../update-checker')
    const result = await checkForUpdate()

    expect(result).toBeNull()
  })

  it('returns null on unsupported platforms (linux)', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
    mockFetch.mockResolvedValue(makeRelease('1.1.0', [DMG_ASSET, EXE_ASSET]))

    const { checkForUpdate } = await import('../update-checker')
    const result = await checkForUpdate()

    expect(result).toBeNull()
  })
})
