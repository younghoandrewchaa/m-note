import type { BrowserWindow } from 'electron'
import { dialog, ipcMain } from 'electron'

export function attachCloseHandler(mainWindow: BrowserWindow) {
  let forceClose = false
  mainWindow.on('close', (e) => {
    if (forceClose) return
    e.preventDefault()
    mainWindow.webContents
      .executeJavaScript('window.__hasUnsavedChanges?.()')
      .then((dirty: boolean) => {
        if (!dirty) {
          forceClose = true
          mainWindow.close()
          return
        }
        const choice = dialog.showMessageBoxSync(mainWindow, {
          type: 'warning',
          buttons: ['Save', "Don't Save", 'Cancel'],
          defaultId: 0,
          cancelId: 2,
          message: 'You have unsaved changes.',
          detail: 'Do you want to save before closing?',
        })
        if (choice === 0) {
          mainWindow.webContents.send('save-before-close')
          ipcMain.once('save-complete', () => {
            forceClose = true
            mainWindow.close()
          })
        } else if (choice === 1) {
          forceClose = true
          mainWindow.close()
        }
      })
  })
}
