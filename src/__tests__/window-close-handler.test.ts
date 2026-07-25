import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockShowMessageBoxSync = vi.fn()
const mockIpcMainOnce = vi.fn()

vi.mock('electron', () => ({
  dialog: { showMessageBoxSync: (...args: any[]) => mockShowMessageBoxSync(...args) },
  ipcMain: { once: (...args: any[]) => mockIpcMainOnce(...args) },
}))

import { attachCloseHandler } from '../window-close-handler'

function createMockWindow() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {}
  return {
    on(event: string, fn: (...args: unknown[]) => void) {
      (listeners[event] ??= []).push(fn)
    },
    close: vi.fn(function (this: any) {
      const closeEvent = { preventDefault: vi.fn() }
      listeners['close']?.forEach((fn) => fn(closeEvent))
      return closeEvent
    }),
    webContents: {
      executeJavaScript: vi.fn(),
      send: vi.fn(),
    },
    _fireClose() {
      const e = { preventDefault: vi.fn() }
      listeners['close']?.forEach((fn) => fn(e))
      return e
    },
  }
}

describe('attachCloseHandler', () => {
  let win: ReturnType<typeof createMockWindow>

  beforeEach(() => {
    vi.clearAllMocks()
    win = createMockWindow()
    attachCloseHandler(win as any)
  })

  it('closes immediately when there are no unsaved changes', async () => {
    win.webContents.executeJavaScript.mockResolvedValue(false)

    const e = win._fireClose()
    await vi.waitFor(() => expect(win.close).toHaveBeenCalled())

    expect(e.preventDefault).toHaveBeenCalled()
    expect(mockShowMessageBoxSync).not.toHaveBeenCalled()
  })

  it('shows save dialog when there are unsaved changes', async () => {
    win.webContents.executeJavaScript.mockResolvedValue(true)
    mockShowMessageBoxSync.mockReturnValue(2) // Cancel

    win._fireClose()
    await vi.waitFor(() => expect(mockShowMessageBoxSync).toHaveBeenCalled())

    expect(mockShowMessageBoxSync).toHaveBeenCalledWith(
      win,
      expect.objectContaining({
        buttons: ['Save', "Don't Save", 'Cancel'],
      }),
    )
  })

  it('saves and closes when user picks "Save"', async () => {
    win.webContents.executeJavaScript.mockResolvedValue(true)
    mockShowMessageBoxSync.mockReturnValue(0) // Save
    mockIpcMainOnce.mockImplementation((_channel: string, cb: () => void) => cb())

    win._fireClose()
    await vi.waitFor(() => expect(win.webContents.send).toHaveBeenCalledWith('save-before-close'))

    expect(mockIpcMainOnce).toHaveBeenCalledWith('save-complete', expect.any(Function))
    expect(win.close).toHaveBeenCalled()
  })

  it('closes without saving when user picks "Don\'t Save"', async () => {
    win.webContents.executeJavaScript.mockResolvedValue(true)
    mockShowMessageBoxSync.mockReturnValue(1) // Don't Save

    win._fireClose()
    await vi.waitFor(() => expect(win.close).toHaveBeenCalled())

    expect(win.webContents.send).not.toHaveBeenCalled()
  })

  it('does not close when user picks "Cancel"', async () => {
    win.webContents.executeJavaScript.mockResolvedValue(true)
    mockShowMessageBoxSync.mockReturnValue(2) // Cancel

    win._fireClose()
    await vi.waitFor(() => expect(mockShowMessageBoxSync).toHaveBeenCalled())

    expect(win.close).not.toHaveBeenCalled()
    expect(win.webContents.send).not.toHaveBeenCalled()
  })
})
