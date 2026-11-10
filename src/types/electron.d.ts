declare const __APP_VERSION__: string

interface ElectronAPI {
  onFileOpened: (callback: (filePath: string) => void) => () => void
  readFile: (filePath: string) => Promise<{ path: string; content: string }>
  checkForUpdate: () => Promise<import('../update-state').UpdateState>
  getUpdateState: () => Promise<import('../update-state').UpdateState>
  onUpdateStateChanged: (callback: (state: import('../update-state').UpdateState) => void) => () => void
  installUpdate: () => Promise<import('../update-state').InstallResult>
  openExternal: (url: string) => Promise<void>
  openLocalFile: (filePath: string) => Promise<boolean>
  saveFile: (filePath: string, content: string) => Promise<void>
  getFilePath: (file: File) => string
  onSaveBeforeClose: (callback: (request: { requestId: string; savePath?: string }) => void) => () => void
  notifySaveComplete: (reply: { requestId: string; success: boolean; error?: string }) => void
  setFilePath: (filePath: string) => Promise<void>
  setDirty: (dirty: boolean) => void
  showSaveDialog: () => Promise<string | null>
}

interface Window {
  __hasUnsavedChanges?: () => boolean
  __currentFilePath?: () => string | null
  __setUpdateFrozen?: (frozen: boolean) => void
  electronAPI: ElectronAPI
}
