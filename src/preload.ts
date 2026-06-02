// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onFileOpened: (callback: (filePath: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath);
    ipcRenderer.on('file-opened', listener);
    return () => ipcRenderer.removeListener('file-opened', listener);
  },
  readFile: (filePath: string): Promise<{ path: string; content: string }> => {
    return ipcRenderer.invoke('read-file', filePath);
  },
  checkForUpdate: (): Promise<{ version: string; downloadUrl: string } | null> => {
    return ipcRenderer.invoke('check-for-update');
  },
  onUpdateDownloaded: (callback: (info: { releaseName: string; updateUrl: string }) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      info: { releaseName: string; updateUrl: string },
    ) => callback(info);
    ipcRenderer.on('auto-update-downloaded', listener);
    return () => ipcRenderer.removeListener('auto-update-downloaded', listener);
  },
  installUpdate: (): Promise<void> => {
    return ipcRenderer.invoke('install-update');
  },
  openExternal: (url: string): Promise<void> => {
    return ipcRenderer.invoke('open-external', url);
  },
  openLocalFile: (filePath: string): Promise<boolean> => {
    return ipcRenderer.invoke('open-local-file', filePath);
  },
  saveFile: (filePath: string, content: string): Promise<void> => {
    return ipcRenderer.invoke('save-file', filePath, content);
  },
  onSaveBeforeClose: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('save-before-close', listener);
    return () => ipcRenderer.removeListener('save-before-close', listener);
  },
  notifySaveComplete: () => {
    ipcRenderer.send('save-complete');
  },
  getFilePath: (file: File) => {
    return webUtils.getPathForFile(file);
  },
  setFilePath: (filePath: string): Promise<void> => {
    return ipcRenderer.invoke('set-file-path', filePath);
  },
});
