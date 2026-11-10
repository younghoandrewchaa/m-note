import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockCheckForNativeUpdate = vi.fn(() => false)
const mockCheckForUpdate = vi.fn(() => Promise.resolve(null))

vi.mock('../auto-updater', () => ({
  checkForNativeUpdate: () => mockCheckForNativeUpdate(),
  getUpdateState: () => ({ status: 'idle', revision: 0 }),
  isInstallingUpdate: () => false,
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
    on: vi.fn(),
  },
  dialog: { showSaveDialog: vi.fn() },
  screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1440, height: 900 } }) },
  session: { defaultSession: { webRequest: { onHeadersReceived: vi.fn() } } },
  shell: { openExternal: vi.fn() },
}))

describe('native update IPC', () => {
  beforeEach(async () => { vi.resetModules(); vi.clearAllMocks(); await import('../main') })
  afterEach(() => { for (const key in ipcHandlers) delete ipcHandlers[key] })
  it('delegates toolbar checks to the shared native lifecycle', async () => {
    await ipcHandlers['check-for-update']()
    expect(mockCheckForNativeUpdate).toHaveBeenCalledOnce()
    expect(mockCheckForUpdate).not.toHaveBeenCalled()
  })
  it('provides a state snapshot to newly opened windows', async () => {
    expect(await ipcHandlers['get-update-state']()).toEqual({ status: 'idle', revision: 0 })
  })
})
