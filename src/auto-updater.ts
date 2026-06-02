import { autoUpdater } from 'electron';

export interface AutoUpdateDownloadedInfo {
  releaseName: string;
  updateUrl: string;
}

interface ConfigureAutoUpdaterOptions {
  isPackaged: boolean;
  notifyRenderer: (channel: 'auto-update-downloaded', info: AutoUpdateDownloadedInfo) => void;
}

const MAC_UPDATE_FEED_URL =
  'https://github.com/younghoandrewchaa/m-note/releases/latest/download/RELEASES.json';

let configured = false;
let updateCheckStarted = false;

export function configureAutoUpdater({
  isPackaged,
  notifyRenderer,
}: ConfigureAutoUpdaterOptions): boolean {
  if (process.platform !== 'darwin' || !isPackaged || configured) {
    return configured;
  }

  autoUpdater.setFeedURL({
    url: MAC_UPDATE_FEED_URL,
    serverType: 'json',
  });

  autoUpdater.on('update-downloaded', (_event, _releaseNotes, releaseName, _releaseDate, updateUrl) => {
    notifyRenderer('auto-update-downloaded', {
      releaseName,
      updateUrl,
    });
  });

  autoUpdater.on('error', (error) => {
    console.error('Auto update failed:', error);
  });

  configured = true;
  return true;
}

export function checkForNativeUpdate(): boolean {
  if (!autoUpdater.getFeedURL()) return false;
  if (updateCheckStarted) return true;
  updateCheckStarted = true;
  autoUpdater.checkForUpdates();
  return true;
}

export function installNativeUpdate(): void {
  autoUpdater.quitAndInstall();
}
