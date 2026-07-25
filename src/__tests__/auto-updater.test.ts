import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockCheckForUpdates = vi.fn()
const mockGetFeedURL = vi.fn(() => '')
const mockOn = vi.fn()
const mockQuitAndInstall = vi.fn()
const mockSetFeedURL = vi.fn()
const mockWebContentsSend = vi.fn()

vi.mock('electron', () => ({
  autoUpdater: {
    checkForUpdates: () => mockCheckForUpdates(),
    getFeedURL: () => mockGetFeedURL(),
    on: (...args: unknown[]) => mockOn(...args),
    quitAndInstall: () => mockQuitAndInstall(),
    setFeedURL: (...args: unknown[]) => mockSetFeedURL(...args),
  },
}))

describe('auto updater', () => {
  let originalPlatform: PropertyDescriptor | undefined

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetFeedURL.mockReturnValue('')
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
  })

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform)
    }
  })

  it('configures Squirrel.Mac feed URL for packaged macOS builds', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    const { configureAutoUpdater } = await import('../auto-updater')

    const result = configureAutoUpdater({
      isPackaged: true,
      notifyRenderer: mockWebContentsSend,
    })

    expect(result).toBe(true)
    expect(mockSetFeedURL).toHaveBeenCalledWith({
      url: 'https://github.com/younghoandrewchaa/m-note/releases/latest/download/RELEASES.json',
      serverType: 'json',
    })
    expect(mockOn).toHaveBeenCalledWith('update-downloaded', expect.any(Function))
  })

  it('does not configure native updates outside packaged macOS builds', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    const { configureAutoUpdater } = await import('../auto-updater')

    const result = configureAutoUpdater({
      isPackaged: false,
      notifyRenderer: mockWebContentsSend,
    })

    expect(result).toBe(false)
    expect(mockSetFeedURL).not.toHaveBeenCalled()
  })

  it('checks native updates only after the feed URL has been configured', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    mockGetFeedURL.mockReturnValue('https://example.com/RELEASES.json')
    const { checkForNativeUpdate } = await import('../auto-updater')

    const result = checkForNativeUpdate()

    expect(result).toBe(true)
    expect(mockCheckForUpdates).toHaveBeenCalledOnce()
  })

  it('does not start duplicate native update checks', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    mockGetFeedURL.mockReturnValue('https://example.com/RELEASES.json')
    const { checkForNativeUpdate } = await import('../auto-updater')

    expect(checkForNativeUpdate()).toBe(true)
    expect(checkForNativeUpdate()).toBe(true)

    expect(mockCheckForUpdates).toHaveBeenCalledOnce()
  })

  it('sends an update-downloaded event to the renderer', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    const { configureAutoUpdater } = await import('../auto-updater')

    configureAutoUpdater({
      isPackaged: true,
      notifyRenderer: mockWebContentsSend,
    })
    const downloadedListener = mockOn.mock.calls.find(([event]) => event === 'update-downloaded')?.[1] as (
      event: unknown,
      releaseNotes: string,
      releaseName: string,
      releaseDate: Date,
      updateUrl: string,
    ) => void

    downloadedListener({}, '', 'M Note 1.2.0', new Date('2026-06-02'), 'https://example.com/MNote.zip')

    expect(mockWebContentsSend).toHaveBeenCalledWith('auto-update-downloaded', {
      releaseName: 'M Note 1.2.0',
      updateUrl: 'https://example.com/MNote.zip',
    })
  })

  it('quits and installs a downloaded update', async () => {
    const { installNativeUpdate } = await import('../auto-updater')

    installNativeUpdate()

    expect(mockQuitAndInstall).toHaveBeenCalledOnce()
  })

  it('hasNativeUpdateFailed returns false before any error occurs', async () => {
    const { hasNativeUpdateFailed } = await import('../auto-updater')

    expect(hasNativeUpdateFailed()).toBe(false)
  })

  it('sets failure flag when auto-updater errors', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    const { configureAutoUpdater, hasNativeUpdateFailed } = await import('../auto-updater')

    configureAutoUpdater({
      isPackaged: true,
      notifyRenderer: mockWebContentsSend,
    })
    const errorListener = mockOn.mock.calls.find(([event]) => event === 'error')?.[1] as (
      error: Error,
    ) => void

    expect(hasNativeUpdateFailed()).toBe(false)

    errorListener(new Error('Update failed'))

    expect(hasNativeUpdateFailed()).toBe(true)
  })
})
