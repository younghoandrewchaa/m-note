import { beforeEach, describe, expect, it, vi } from 'vitest'

type MockBrowserWindowOptions = Record<string, unknown>
type MockBounds = { x: number; y: number; width: number; height: number }

const appHandlers: Record<string, (...args: any[]) => void> = {}
const browserWindowOptions: MockBrowserWindowOptions[] = []
const mockGetBounds = vi.fn<() => MockBounds>()
const windowListeners: Record<string, Array<() => void>> = {}

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/user/data'),
    on: (event: string, cb: (...args: any[]) => void) => {
      appHandlers[event] = cb
    },
    quit: vi.fn(),
  },
  BrowserWindow: class MockBW {
    webContents = { id: 1, on: vi.fn(), send: vi.fn() }
    constructor(options: MockBrowserWindowOptions) {
      browserWindowOptions.push(options)
    }
    getBounds = mockGetBounds
    on(event: string, cb: () => void) {
      (windowListeners[event] ??= []).push(cb)
    }
    loadURL() {
      // no-op
    }
    loadFile() {
      // no-op
    }
    static getAllWindows(): unknown[] { return [] }
  },
  ipcMain: { handle: vi.fn() },
  screen: {
    getPrimaryDisplay: () => ({ workAreaSize: { width: 1440, height: 900 } }),
    getAllDisplays: () => [
      { workArea: { x: 0, y: 0, width: 1440, height: 900 } },
    ],
  },
  session: { defaultSession: { webRequest: { onHeadersReceived: vi.fn() } } },
  shell: { openExternal: vi.fn() },
}))

vi.mock('electron-squirrel-startup', () => ({ default: false }))
vi.mock('../auto-updater', () => ({
  checkForNativeUpdate: vi.fn(() => false),
  configureAutoUpdater: vi.fn(),
  hasNativeUpdateFailed: vi.fn(() => false),
  installNativeUpdate: vi.fn(),
}))
vi.mock('../update-checker', () => ({ checkForUpdate: vi.fn() }))
vi.mock('../window-close-handler', () => ({ attachCloseHandler: vi.fn() }))
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    promises: { readFile: vi.fn(), writeFile: vi.fn() },
    readFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}))
vi.mock('node:path', () => ({
  default: { join: (...parts: string[]) => parts.join('/') },
}))

async function importFreshMain() {
  vi.resetModules()
  browserWindowOptions.length = 0
  Object.keys(appHandlers).forEach((key) => delete appHandlers[key])
  Object.keys(windowListeners).forEach((key) => delete windowListeners[key])
  const globals = globalThis as Record<string, unknown>
  globals.MAIN_WINDOW_VITE_DEV_SERVER_URL = undefined
  globals.MAIN_WINDOW_VITE_NAME = 'main_window'
  await import('../main')
}

describe('remember window position', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('uses default half-screen bounds when no saved state exists', async () => {
    await importFreshMain()

    appHandlers.ready()

    expect(browserWindowOptions[0]).toEqual(expect.objectContaining({
      x: 0,
      y: 0,
      width: 720,
      height: 900,
    }))
  })

  it('uses valid saved bounds for newly created windows', async () => {
    const fs = await import('node:fs')
    vi.mocked(fs.default.existsSync).mockReturnValue(true)
    vi.mocked(fs.default.readFileSync).mockReturnValue(
      JSON.stringify({ x: 80, y: 90, width: 1000, height: 760 }),
    )
    await importFreshMain()

    appHandlers.ready()

    expect(browserWindowOptions[0]).toEqual(expect.objectContaining({
      x: 80,
      y: 90,
      width: 1000,
      height: 760,
    }))
  })

  it('falls back when saved bounds are off-screen', async () => {
    const fs = await import('node:fs')
    vi.mocked(fs.default.existsSync).mockReturnValue(true)
    vi.mocked(fs.default.readFileSync).mockReturnValue(
      JSON.stringify({ x: 2000, y: 100, width: 1000, height: 760 }),
    )
    await importFreshMain()

    appHandlers.ready()

    expect(browserWindowOptions[0]).toEqual(expect.objectContaining({
      x: 0,
      y: 0,
      width: 720,
      height: 900,
    }))
  })

  it('writes moved window bounds after the debounce interval', async () => {
    vi.useFakeTimers()
    const fs = await import('node:fs')
    await importFreshMain()
    mockGetBounds.mockReturnValue({ x: 20, y: 30, width: 900, height: 700 })

    appHandlers.ready()
    windowListeners.move[0]()

    vi.advanceTimersByTime(249)
    expect(fs.default.writeFileSync).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(fs.default.writeFileSync).toHaveBeenCalledWith(
      '/user/data/window-state.json',
      JSON.stringify({ x: 20, y: 30, width: 900, height: 700 }, null, 2),
      'utf-8',
    )
  })

  it('writes resized window bounds after the debounce interval', async () => {
    vi.useFakeTimers()
    const fs = await import('node:fs')
    await importFreshMain()
    mockGetBounds.mockReturnValue({ x: 40, y: 50, width: 1100, height: 800 })

    appHandlers.ready()
    windowListeners.resize[0]()
    vi.advanceTimersByTime(250)

    expect(fs.default.writeFileSync).toHaveBeenCalledWith(
      '/user/data/window-state.json',
      JSON.stringify({ x: 40, y: 50, width: 1100, height: 800 }, null, 2),
      'utf-8',
    )
  })

  it('flushes pending bounds on before-quit even if the debounce timer has not fired', async () => {
    vi.useFakeTimers()
    const fs = await import('node:fs')
    await importFreshMain()
    mockGetBounds.mockReturnValue({ x: 15, y: 25, width: 950, height: 720 })

    appHandlers.ready()
    windowListeners.resize[0]()

    // Simulate quitting immediately after a Rectangle-style resize, before
    // the 250ms debounce would otherwise have written the file.
    appHandlers['before-quit']()

    expect(fs.default.writeFileSync).toHaveBeenCalledWith(
      '/user/data/window-state.json',
      JSON.stringify({ x: 15, y: 25, width: 950, height: 720 }, null, 2),
      'utf-8',
    )
  })

  it('flushes pending bounds on window-all-closed before quitting', async () => {
    vi.useFakeTimers()
    const fs = await import('node:fs')
    await importFreshMain()
    mockGetBounds.mockReturnValue({ x: 35, y: 45, width: 980, height: 760 })

    appHandlers.ready()
    windowListeners.move[0]()
    appHandlers['window-all-closed']()

    expect(fs.default.writeFileSync).toHaveBeenCalledWith(
      '/user/data/window-state.json',
      JSON.stringify({ x: 35, y: 45, width: 980, height: 760 }, null, 2),
      'utf-8',
    )
  })

  it('uses the most recently moved window bounds for the next file-open window', async () => {
    vi.useFakeTimers()
    const fs = await import('node:fs')
    vi.mocked(fs.default.existsSync).mockReturnValue(false)
    await importFreshMain()

    appHandlers.ready()
    mockGetBounds.mockReturnValue({ x: 60, y: 70, width: 1000, height: 740 })
    windowListeners.resize[0]()
    vi.advanceTimersByTime(250)

    vi.mocked(fs.default.existsSync).mockReturnValue(true)
    vi.mocked(fs.default.readFileSync).mockReturnValue(
      JSON.stringify({ x: 60, y: 70, width: 1000, height: 740 }),
    )
    appHandlers['open-file']({ preventDefault: vi.fn() }, '/notes/next.md')

    expect(browserWindowOptions[1]).toEqual(expect.objectContaining({
      x: 60,
      y: 70,
      width: 1000,
      height: 740,
    }))
  })
})
