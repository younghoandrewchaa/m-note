// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  onFileOpened: (callback: (filePath: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath)
    ipcRenderer.on('file-opened', listener)
    return () => ipcRenderer.removeListener('file-opened', listener)
  },
  readFile: (filePath: string): Promise<{ path: string; content: string }> => {
    return ipcRenderer.invoke('read-file', filePath)
  },
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),
  onUpdateStateChanged: (callback: (state: import('./update-state').UpdateState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: import('./update-state').UpdateState) => callback(state)
    ipcRenderer.on('update-state-changed', listener)
    return () => ipcRenderer.removeListener('update-state-changed', listener)
  },
  installUpdate: () => ipcRenderer.invoke('install-update'),
  openExternal: (url: string): Promise<void> => {
    return ipcRenderer.invoke('open-external', url)
  },
  openLocalFile: (filePath: string): Promise<boolean> => {
    return ipcRenderer.invoke('open-local-file', filePath)
  },
  saveFile: (filePath: string, content: string): Promise<void> => {
    return ipcRenderer.invoke('save-file', filePath, content)
  },
  onSaveBeforeClose: (callback: (request: { requestId: string; savePath?: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, request: { requestId: string; savePath?: string }) => callback(request)
    ipcRenderer.on('save-before-close', listener)
    return () => ipcRenderer.removeListener('save-before-close', listener)
  },
  notifySaveComplete: (reply: { requestId: string; success: boolean; error?: string }) => {
    ipcRenderer.send('save-complete', reply)
  },
  getFilePath: (file: File) => {
    return webUtils.getPathForFile(file)
  },
  setFilePath: (filePath: string): Promise<void> => {
    return ipcRenderer.invoke('set-file-path', filePath)
  },
  setDirty: (dirty: boolean): void => {
    ipcRenderer.send('set-dirty', dirty)
  },
  showSaveDialog: (): Promise<string | null> => {
    return ipcRenderer.invoke('show-save-dialog')
  },
})
