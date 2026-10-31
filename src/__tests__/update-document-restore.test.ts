import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

type Handler = (...args: unknown[]) => unknown
interface TestWindow extends EventEmitter {
  webContents: EventEmitter & { id: number; send: ReturnType<typeof vi.fn> }
}
const mocks = vi.hoisted(() => ({
  app: new Map<string, Handler>(),
  ipc: new Map<string, Handler>(),
  windows: [] as TestWindow[],
  userData: '',
  configure: vi.fn(),
  prepare: vi.fn(),
}))
vi.mock('electron', () => ({
  app: {
    getPath: () => mocks.userData,
    on: (event: string, fn: Handler) => mocks.app.set(event, fn),
    quit: vi.fn(),
    isPackaged: true,
  },
  BrowserWindow: class extends EventEmitter {
    webContents = Object.assign(new EventEmitter(), {
      id: mocks.windows.length + 1,
      send: vi.fn(),
    })
    constructor() { super(); mocks.windows.push(this) }
    loadFile() { return Promise.resolve() }
    isDestroyed() { return false }
    static getAllWindows() { return mocks.windows }
  },
  ipcMain: { handle: (name: string, fn: Handler) => mocks.ipc.set(name, fn) },
  screen: {
    getPrimaryDisplay: () => ({ workAreaSize: { width: 1440, height: 900 } }),
    getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1440, height: 900 } }],
  },
  shell: {},
  session: {},
}))
vi.mock('electron-squirrel-startup', () => ({ default: false }))
vi.mock('../auto-updater', () => ({
  configureAutoUpdater: mocks.configure,
  checkForNativeUpdate: vi.fn(),
  getUpdateState: vi.fn(),
  isInstallingUpdate: () => false,
  installNativeUpdate: vi.fn(),
}))
vi.mock('../update-installation', () => ({
  prepareWindowsForUpdate: mocks.prepare,
  restoreUpdateWindows: vi.fn(),
}))
vi.mock('../window-close-handler', () => ({ attachCloseHandler: vi.fn() }))

async function launch(files: string[] = []) {
  vi.resetModules()
  mocks.windows = []
  const globals = globalThis as Record<string, unknown>
  globals.MAIN_WINDOW_VITE_DEV_SERVER_URL = undefined
  globals.MAIN_WINDOW_VITE_NAME = 'main_window'
  await import('../main')
  for (const file of files) mocks.app.get('open-file')?.({ preventDefault: vi.fn() }, file)
  mocks.app.get('ready')?.()
}
function openedFiles() {
  return mocks.windows.map((window) => {
    window.webContents.emit('did-finish-load')
    return window.webContents.send.mock.calls.find(([channel]: string[]) => channel === 'file-opened')?.[1]
  })
}
function options() { return mocks.configure.mock.lastCall?.[0] }
let first: string
let second: string
beforeEach(() => {
  vi.clearAllMocks()
  mocks.prepare.mockResolvedValue(true)
  mocks.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'm-note-update-'))
  first = path.join(mocks.userData, 'first.md')
  second = path.join(mocks.userData, 'second.markdown')
  fs.writeFileSync(first, '# First')
  fs.writeFileSync(second, '# Second')
})
afterEach(() => fs.rmSync(mocks.userData, { recursive: true, force: true }))

it('reopens documents after an update restart, only once', async () => {
  await launch([first, second])
  expect(await options().prepareInstall()).toBe(true)
  await launch()
  expect(openedFiles()).toEqual([first, second])
  await launch()
  expect(openedFiles()).toEqual([undefined])
})

it('captures a newly saved document after update preparation', async () => {
  await launch()
  mocks.prepare.mockImplementationOnce(async () => {
    await mocks.ipc.get('set-file-path')?.({ sender: mocks.windows[0].webContents }, first)
    return true
  })
  await options().prepareInstall()
  await launch()
  expect(openedFiles()).toEqual([first])
})

it('does not restore documents after a cancelled update', async () => {
  await launch([first])
  mocks.prepare.mockResolvedValueOnce(false)
  expect(await options().prepareInstall()).toBe(false)
  await launch()
  expect(openedFiles()).toEqual([undefined])
})

it('clears the restore session if installation fails', async () => {
  await launch([first])
  await options().prepareInstall()
  options().restoreWindows()
  await launch()
  expect(openedFiles()).toEqual([undefined])
})

it('merges launch documents without duplicates and skips deleted documents', async () => {
  await launch([first, second])
  await options().prepareInstall()
  fs.unlinkSync(second)
  await launch([first])
  expect(openedFiles()).toEqual([first])
})

it('excludes closed windows from the update session', async () => {
  await launch([first, second])
  mocks.windows.shift()
  await options().prepareInstall()
  await launch()
  expect(openedFiles()).toEqual([second])
})

it('opens an empty window when all saved documents have been deleted', async () => {
  await launch([first])
  await options().prepareInstall()
  fs.unlinkSync(first)
  await launch()
  expect(openedFiles()).toEqual([undefined])
})

it.each(['invalid json', '{}', '[null, 42, "missing.md"]'])(
  'ignores a malformed restore session: %s',
  async (content) => {
    fs.writeFileSync(path.join(mocks.userData, 'update-session.json'), content)
    await launch()
    expect(openedFiles()).toEqual([undefined])
    expect(fs.existsSync(path.join(mocks.userData, 'update-session.json'))).toBe(false)
  },
)
