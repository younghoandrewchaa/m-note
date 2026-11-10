import { EventEmitter } from 'node:events'
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  dialog: {
    showMessageBoxSync: vi.fn(),
    showSaveDialog: vi.fn(),
    showErrorBox: vi.fn(),
  },
}))
const ipc = new EventEmitter()
vi.mock('electron', () => ({
  dialog: mocks.dialog,
  ipcMain: {
    on: (...args: any[]) => ipc.on(args[0], args[1]),
    removeListener: (...args: any[]) => ipc.removeListener(args[0], args[1]),
  },
}))
import {
  attachCloseHandler,
  prepareWindowForClose,
  prepareWindowsForQuit,
} from '../window-close-handler'
function windowMock() {
  const win = new EventEmitter() as any
  win.webContents = {
    executeJavaScript: vi.fn().mockResolvedValue(true),
    send: vi.fn(),
  }
  win.close = vi.fn()
  win.focus = vi.fn()
  win.isDestroyed = vi.fn(() => false)
  return win
}
beforeEach(() => {
  vi.clearAllMocks()
  ipc.removeAllListeners()
})
it('closes clean windows', async () => {
  const win = windowMock()
  win.webContents.executeJavaScript.mockResolvedValue(false)
  attachCloseHandler(win)
  win.emit('close', { preventDefault: vi.fn() })
  await vi.waitFor(() => expect(win.close).toHaveBeenCalledOnce())
})
it('cancellation preserves window', async () => {
  const win = windowMock()
  mocks.dialog.showMessageBoxSync.mockReturnValue(2)
  expect(await prepareWindowForClose(win)).toBe(false)
  expect(win.close).not.toHaveBeenCalled()
})
it('discard permits close', async () => {
  const win = windowMock()
  mocks.dialog.showMessageBoxSync.mockReturnValue(1)
  expect(await prepareWindowForClose(win)).toBe(true)
})
it('only accepts the requested window and request ID', async () => {
  const win = windowMock()
  mocks.dialog.showMessageBoxSync.mockReturnValue(0)
  const pending = prepareWindowForClose(win)
  await vi.waitFor(() => expect(win.webContents.send).toHaveBeenCalled())
  const request = win.webContents.send.mock.calls[0][1]
  ipc.emit(
    'save-complete',
    { sender: {} },
    { requestId: request.requestId, success: true },
  )
  ipc.emit(
    'save-complete',
    { sender: win.webContents },
    { requestId: 'wrong', success: true },
  )
  expect(ipc.listenerCount('save-complete')).toBe(1)
  ipc.emit(
    'save-complete',
    { sender: win.webContents },
    { requestId: request.requestId, success: true },
  )
  expect(await pending).toBe(true)
  expect(ipc.listenerCount('save-complete')).toBe(0)
})
it('propagates write failure without closing', async () => {
  const win = windowMock()
  mocks.dialog.showMessageBoxSync.mockReturnValue(0)
  const pending = prepareWindowForClose(win)
  const assertion = expect(pending).rejects.toThrow('disk full')
  await vi.waitFor(() => expect(win.webContents.send).toHaveBeenCalled())
  ipc.emit(
    'save-complete',
    { sender: win.webContents },
    {
      requestId: win.webContents.send.mock.calls[0][1].requestId,
      success: false,
      error: 'disk full',
    },
  )
  await assertion
  expect(win.close).not.toHaveBeenCalled()
})
it('cancels an untitled save without sending a false acknowledgement', async () => {
  const win = windowMock()
  win.webContents.executeJavaScript
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(false)
  mocks.dialog.showMessageBoxSync.mockReturnValue(0)
  mocks.dialog.showSaveDialog.mockResolvedValue({ canceled: true })
  expect(await prepareWindowForClose(win)).toBe(false)
  expect(win.webContents.send).not.toHaveBeenCalled()
})
it('sends the selected destination for an untitled note', async () => {
  const win = windowMock()
  win.webContents.executeJavaScript
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(false)
  mocks.dialog.showMessageBoxSync.mockReturnValue(0)
  mocks.dialog.showSaveDialog.mockResolvedValue({
    canceled: false,
    filePath: '/tmp/note.md',
  })
  const pending = prepareWindowForClose(win)
  await vi.waitFor(() => expect(win.webContents.send).toHaveBeenCalled())
  const request = win.webContents.send.mock.calls[0][1]
  expect(request.savePath).toBe('/tmp/note.md')
  ipc.emit(
    'save-complete',
    { sender: win.webContents },
    { requestId: request.requestId, success: true },
  )
  expect(await pending).toBe(true)
})
it('cleans pending save when window is destroyed', async () => {
  const win = windowMock()
  mocks.dialog.showMessageBoxSync.mockReturnValue(0)
  const pending = prepareWindowForClose(win)
  await vi.waitFor(() => expect(win.webContents.send).toHaveBeenCalled())
  win.emit('closed')
  expect(await pending).toBe(false)
  expect(ipc.listenerCount('save-complete')).toBe(0)
})
it('times out when the renderer never returns its dirty state', async () => {
  vi.useFakeTimers()
  const win = windowMock()
  win.webContents.executeJavaScript.mockReturnValue(
    new Promise(() => undefined),
  )
  const pending = prepareWindowForClose(win)
  const assertion = expect(pending).rejects.toThrow('did not respond')
  await vi.advanceTimersByTimeAsync(30_000)
  await assertion
  vi.useRealTimers()
})
it('focuses each unsaved tab before its prompt', async () => {
  const [a, b] = [windowMock(), windowMock()]
  const order: string[] = []
  a.focus.mockImplementation(() => order.push('focus a'))
  b.focus.mockImplementation(() => order.push('focus b'))
  mocks.dialog.showMessageBoxSync.mockImplementation((win: any) => {
    order.push(win === a ? 'prompt a' : 'prompt b')
    return 1
  })
  expect(await prepareWindowsForQuit([a, b], () => true)).toBe(true)
  expect(order).toEqual(['focus a', 'prompt a', 'focus b', 'prompt b'])
})
it('skips clean tabs', async () => {
  const win = windowMock()
  win.webContents.executeJavaScript.mockResolvedValue(false)
  expect(await prepareWindowsForQuit([win], () => false)).toBe(true)
  expect(win.focus).not.toHaveBeenCalled()
  expect(mocks.dialog.showMessageBoxSync).not.toHaveBeenCalled()
})
it('cancel stops the quit and keeps every tab', async () => {
  const [a, b] = [windowMock(), windowMock()]
  mocks.dialog.showMessageBoxSync.mockReturnValueOnce(1).mockReturnValueOnce(2)
  expect(await prepareWindowsForQuit([a, b], () => true)).toBe(false)
  attachCloseHandler(a)
  const event = { preventDefault: vi.fn() }
  a.emit('close', event)
  expect(event.preventDefault).toHaveBeenCalled()
})
it('a second quit while prompting reuses the first', async () => {
  const [a, b] = [windowMock(), windowMock()]
  mocks.dialog.showMessageBoxSync.mockReturnValue(1)
  const first = prepareWindowsForQuit([a, b], () => true)
  const second = prepareWindowsForQuit([a, b], () => true)
  expect(second).toBe(first)
  await first
  expect(mocks.dialog.showMessageBoxSync).toHaveBeenCalledTimes(2)
})
