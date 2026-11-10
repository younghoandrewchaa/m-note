import type { BrowserWindow, IpcMainEvent } from 'electron'
import { dialog, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
const approved = new WeakSet<BrowserWindow>()
const pending = new WeakSet<BrowserWindow>()
const frozen = new WeakSet<BrowserWindow>()
async function readRenderer<T>(
  window: BrowserWindow,
  script: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('The editor did not respond. Please retry.')),
      30_000,
    )
  })
  try {
    return await Promise.race([
      window.webContents.executeJavaScript(script) as Promise<T>,
      timeout,
    ])
  } finally {
    clearTimeout(timer)
  }
}
export function approveWindowClose(window: BrowserWindow) {
  approved.add(window)
}
export function resetWindowClose(window: BrowserWindow) {
  approved.delete(window)
}
export async function setWindowFrozen(
  window: BrowserWindow,
  value: boolean,
): Promise<void> {
  if (value && pending.has(window))
    throw new Error('A window is already closing. Please retry.')
  if (value) frozen.add(window)
  else frozen.delete(window)
  await readRenderer(
    window,
    `(() => { if (!window.__setUpdateFrozen) throw new Error("The editor is still loading. Please retry."); window.__setUpdateFrozen(${value}); })()`,
  )
}
export async function prepareWindowForClose(
  window: BrowserWindow,
): Promise<boolean> {
  const dirty = await readRenderer<boolean>(
    window,
    'window.__hasUnsavedChanges?.()',
  )
  if (!dirty) return true
  const choice = dialog.showMessageBoxSync(window, {
    type: 'warning',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    message: 'You have unsaved changes.',
    detail: 'Do you want to save before closing?',
  })
  if (choice === 2) return false
  if (choice === 1) return true
  // Select a destination before the bounded renderer reply wait starts.
  let savePath: string | undefined
  const hasPath = await readRenderer<boolean>(
    window,
    'Boolean(window.__currentFilePath?.())',
  )
  if (!hasPath) {
    const result = await dialog.showSaveDialog(window, {
      defaultPath: 'Untitled.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (result.canceled || !result.filePath) return false
    savePath = result.filePath
  }
  const requestId = randomUUID()
  return new Promise<boolean>((resolve, reject) => {
    const finish = (success: boolean, message?: string) => {
      clearTimeout(timeout)
      ipcMain.removeListener('save-complete', listener)
      window.removeListener('closed', closed)
      if (message) reject(new Error(message))
      else resolve(success)
    }
    const listener = (
      event: IpcMainEvent,
      reply: { requestId: string; success: boolean; error?: string },
    ) => {
      if (event.sender !== window.webContents || reply?.requestId !== requestId)
        return
      finish(reply.success === true, reply.error)
    }
    const closed = () => finish(false)
    const timeout = setTimeout(
      () => finish(false, 'The editor did not respond. Please retry.'),
      30_000,
    )
    ipcMain.on('save-complete', listener)
    window.once('closed', closed)
    window.webContents.send('save-before-close', { requestId, savePath })
  })
}
function showSaveError(error: unknown) {
  dialog.showErrorBox(
    'Unable to save',
    error instanceof Error ? error.message : 'Please retry saving your note.',
  )
}
export function attachCloseHandler(window: BrowserWindow) {
  window.on('close', (event) => {
    if (approved.has(window)) return
    event.preventDefault()
    if (pending.has(window) || frozen.has(window)) return
    pending.add(window)
    void prepareWindowForClose(window)
      .then((ready) => {
        if (ready) {
          approved.add(window)
          window.close()
        }
      })
      .catch(showSaveError)
      .finally(() => pending.delete(window))
  })
}
let quitInFlight: Promise<boolean> | null = null
async function walkWindowsForQuit(
  windows: BrowserWindow[],
  isDirty: (window: BrowserWindow) => boolean,
): Promise<boolean> {
  try {
    for (const window of windows) {
      if (window.isDestroyed()) continue
      if (isDirty(window)) window.focus()
      if (!(await prepareWindowForClose(window))) {
        windows.forEach(resetWindowClose)
        return false
      }
      approveWindowClose(window)
    }
    return true
  } catch (error) {
    windows.forEach(resetWindowClose)
    showSaveError(error)
    return false
  }
}
export function prepareWindowsForQuit(
  windows: BrowserWindow[],
  isDirty: (window: BrowserWindow) => boolean,
): Promise<boolean> {
  if (quitInFlight) return quitInFlight
  const walk = walkWindowsForQuit(windows, isDirty).finally(() => {
    quitInFlight = null
  })
  quitInFlight = walk
  return walk
}
