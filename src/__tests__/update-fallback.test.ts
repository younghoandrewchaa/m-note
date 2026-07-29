import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockCheckForNativeUpdate = vi.fn(() => false)
const mockHasNativeUpdateFailed = vi.fn(() => false)
const mockCheckForUpdate = vi.fn(() => Promise.resolve(null))

vi.mock('../auto-updater', () => ({
  checkForNativeUpdate: () => mockCheckForNativeUpdate(),
  hasNativeUpdateFailed: () => mockHasNativeUpdateFailed(),
  configureAutoUpdater: vi.fn(),
  installNativeUpdate: vi.fn(),
}))

vi.mock('../update-checker', () => ({
  checkForUpdate: () => mockCheckForUpdate(),
}))

vi.mock('../window-close-handler', () => ({
  attachCloseHandler: vi.fn(),
}))

vi.mock('electron-squirrel-startup', () => ({ default: false }))

vi.mock('node:fs', () => ({
  default: {
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
    },
    existsSync: vi.fn(() => true),
  },
}))

vi.mock('node:path', () => ({
  default: { join: (...parts: string[]) => parts.join('/') },
}))

const ipcHandlers: Record<string, (...args: unknown[]) => unknown> = {}

vi.mock('electron', () => ({
  app: {
    quit: vi.fn(),
    on: vi.fn(),
    isPackaged: false,
  },
  BrowserWindow: class MockBW {
    webContents = {
      id: 1,
      once() {
        // no-op
      },
      on() {
        // no-op
      },
      send() {
        // no-op
      },
    }
    loadURL() {
      // no-op
    }
    loadFile() {
      // no-op
    }
    static getAllWindows(): unknown[] {
      return []
    }
  },
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      ipcHandlers[channel] = fn
    },
  },
  screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1440, height: 900 } }) },
  session: { defaultSession: { webRequest: { onHeadersReceived: vi.fn() } } },
  shell: { openExternal: vi.fn() },
}))

// GitHub's release API is the single source of truth for "is there an update"
// (see update-checker.test.ts) — Squirrel.Mac can't make that call itself
// because its feed URL is a static GitHub Releases asset that always answers
// 200, never the 204 it needs to mean "no update". So the native updater is
// only ever used as a download+install mechanism, triggered exclusively when
// GitHub has already confirmed a newer version exists.
describe('update fallback behavior', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    mockCheckForNativeUpdate.mockReturnValue(false)
    mockHasNativeUpdateFailed.mockReturnValue(false)
    mockCheckForUpdate.mockResolvedValue(null)
    await import('../main')
  })

  afterEach(() => {
    for (const key in ipcHandlers) {
      delete ipcHandlers[key]
    }
  })

  it('always asks GitHub, even while the native updater is active', async () => {
    mockCheckForNativeUpdate.mockReturnValue(true)
    mockHasNativeUpdateFailed.mockReturnValue(false)
    mockCheckForUpdate.mockResolvedValue(null)

    const result = await ipcHandlers['check-for-update']()

    expect(mockCheckForUpdate).toHaveBeenCalledOnce()
    expect(result).toBeNull()
  })

  it('triggers the native download+install when GitHub reports a newer version', async () => {
    mockHasNativeUpdateFailed.mockReturnValue(false)
    mockCheckForUpdate.mockResolvedValue({ version: '1.2.0', downloadUrl: 'https://example.com/MNote.dmg' })

    const result = await ipcHandlers['check-for-update']()

    expect(mockCheckForNativeUpdate).toHaveBeenCalledOnce()
    expect(result).toEqual({ version: '1.2.0', downloadUrl: 'https://example.com/MNote.dmg' })
  })

  it('does not trigger the native updater when GitHub reports no update', async () => {
    mockCheckForUpdate.mockResolvedValue(null)

    const result = await ipcHandlers['check-for-update']()

    expect(mockCheckForNativeUpdate).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('does not retry the native download once it has already failed', async () => {
    mockHasNativeUpdateFailed.mockReturnValue(true)
    mockCheckForUpdate.mockResolvedValue({ version: '1.2.0', downloadUrl: 'https://example.com/MNote.dmg' })

    const result = await ipcHandlers['check-for-update']()

    expect(mockCheckForNativeUpdate).not.toHaveBeenCalled()
    expect(result).toEqual({ version: '1.2.0', downloadUrl: 'https://example.com/MNote.dmg' })
  })
})
