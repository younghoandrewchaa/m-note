import { describe, it, expect, vi, beforeAll } from 'vitest'

type MockWebContents = {
  id: number
  handlers: Record<string, Array<{ fn: (...a: unknown[]) => void; once: boolean }>>
  send: ReturnType<typeof vi.fn>
  on(event: string, fn: (...a: unknown[]) => void): void
  once(event: string, fn: (...a: unknown[]) => void): void
  emit(event: string, ...args: unknown[]): void
}

let capturedWebContents: MockWebContents
let nextId = 1

function createMockWebContents(): MockWebContents {
  const id = nextId++
  const handlers: MockWebContents['handlers'] = {}
  return {
    id,
    handlers,
    send: vi.fn(),
    on(event, fn) {
      (handlers[event] ??= []).push({ fn, once: false })
    },
    once(event, fn) {
      (handlers[event] ??= []).push({ fn, once: true })
    },
    emit(event, ...args) {
      const listeners = handlers[event] ?? []
      const remaining: typeof listeners = []
      for (const l of listeners) {
        l.fn(...args)
        if (!l.once) remaining.push(l)
      }
      handlers[event] = remaining
    },
  }
}

const appHandlers: Record<string, (...args: unknown[]) => void> = {}
const ipcHandlers: Record<string, (event: { sender: { id: number } }, ...args: unknown[]) => unknown> = {}

vi.mock('electron', () => ({
  app: {
    quit: vi.fn(),
    getPath: vi.fn(() => '/user/data'),
    on: (event: string, cb: (...args: unknown[]) => void) => {
      appHandlers[event] = cb
    },
  },
  BrowserWindow: class MockBW {
    webContents: MockWebContents
    constructor() {
      this.webContents = createMockWebContents()
      capturedWebContents = this.webContents
    }
    getBounds() {
      return { x: 0, y: 0, width: 720, height: 900 }
    }
    on() {
      // no-op
    }
    loadURL() {
      // no-op
    }
    loadFile() {
      // no-op
    }
    static getAllWindows(): unknown[] { return [] }
  },
  ipcMain: {
    handle: (channel: string, fn: (event: { sender: { id: number } }, ...args: unknown[]) => unknown) => {
      ipcHandlers[channel] = fn
    },
  },
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
vi.mock('../update-checker', () => ({ checkForUpdate: vi.fn() }))
vi.mock('../window-close-handler', () => ({ attachCloseHandler: vi.fn() }))
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    promises: { readFile: vi.fn(), writeFile: vi.fn() },
  },
}))
vi.mock('node:path', () => ({
  default: { join: (...parts: string[]) => parts.join('/') },
}))

beforeAll(async () => {
  const globals = globalThis as Record<string, unknown>
  globals.MAIN_WINDOW_VITE_DEV_SERVER_URL = undefined
  globals.MAIN_WINDOW_VITE_NAME = 'main_window'
  await import('../main')
})

describe('CMD+R reload', () => {
  it('re-sends file-opened on every did-finish-load for files opened via open-file event', () => {
    const filePath = '/test/notes.md'

    appHandlers['open-file']?.({ preventDefault: vi.fn() }, filePath)
    appHandlers['ready']?.()

    capturedWebContents.emit('did-finish-load')
    expect(capturedWebContents.send).toHaveBeenCalledTimes(1)
    expect(capturedWebContents.send).toHaveBeenCalledWith('file-opened', filePath)

    capturedWebContents.emit('did-finish-load')
    expect(capturedWebContents.send).toHaveBeenCalledTimes(2)
    expect(capturedWebContents.send).toHaveBeenNthCalledWith(2, 'file-opened', filePath)
  })

  it('re-sends file-opened after drag-and-drop registers a path via set-file-path IPC', async () => {
    const droppedPath = '/test/dropped.md'

    // Create a new window with no initial file (simulates a bare createWindow())
    appHandlers['ready']?.()

    // did-finish-load before any file is set — nothing should be sent
    capturedWebContents.emit('did-finish-load')
    expect(capturedWebContents.send).not.toHaveBeenCalled()

    // Renderer drag-and-drops a file and calls set-file-path IPC
    await ipcHandlers['set-file-path']?.({ sender: { id: capturedWebContents.id } }, droppedPath)

    // CMD+R reload — main should now re-send the dropped file path
    capturedWebContents.emit('did-finish-load')
    expect(capturedWebContents.send).toHaveBeenCalledWith('file-opened', droppedPath)
  })
})
