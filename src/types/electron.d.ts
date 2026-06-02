interface ElectronAPI {
  onFileOpened: (callback: (filePath: string) => void) => () => void;
  readFile: (filePath: string) => Promise<{ path: string; content: string }>;
  checkForUpdate: () => Promise<{ version: string; downloadUrl: string } | null>;
  onUpdateDownloaded: (
    callback: (info: { releaseName: string; updateUrl: string }) => void,
  ) => () => void;
  installUpdate: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  openLocalFile: (filePath: string) => Promise<boolean>;
  saveFile: (filePath: string, content: string) => Promise<void>;
  getFilePath: (file: File) => string;
  onSaveBeforeClose: (callback: () => void) => () => void;
  notifySaveComplete: () => void;
}

interface Window {
  electronAPI: ElectronAPI;
}
