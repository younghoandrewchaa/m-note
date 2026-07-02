import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckForNativeUpdate = vi.fn(() => false);
const mockHasNativeUpdateFailed = vi.fn(() => false);
const mockCheckForUpdate = vi.fn(() => Promise.resolve(null));

vi.mock('../auto-updater', () => ({
  checkForNativeUpdate: () => mockCheckForNativeUpdate(),
  hasNativeUpdateFailed: () => mockHasNativeUpdateFailed(),
  configureAutoUpdater: vi.fn(),
  installNativeUpdate: vi.fn(),
}));

vi.mock('../update-checker', () => ({
  checkForUpdate: () => mockCheckForUpdate(),
}));

vi.mock('../window-close-handler', () => ({
  attachCloseHandler: vi.fn(),
}));

vi.mock('electron-squirrel-startup', () => ({ default: false }));

vi.mock('node:fs', () => ({
  default: {
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
    },
    existsSync: vi.fn(() => true),
  },
}));

vi.mock('node:path', () => ({
  default: { join: (...parts: string[]) => parts.join('/') },
}));

const ipcHandlers: Record<string, (...args: unknown[]) => unknown> = {};

vi.mock('electron', () => ({
  app: {
    quit: vi.fn(),
    on: vi.fn(),
    isPackaged: false,
  },
  BrowserWindow: class MockBW {
    webContents = {
      id: 1,
      once() {
        // no-op
      },
      on() {
        // no-op
      },
      send() {
        // no-op
      },
    };
    loadURL() {
      // no-op
    }
    loadFile() {
      // no-op
    }
    static getAllWindows() {
      return [];
    }
  },
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      ipcHandlers[channel] = fn;
    },
  },
  screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1440, height: 900 } }) },
  session: { defaultSession: { webRequest: { onHeadersReceived: vi.fn() } } },
  shell: { openExternal: vi.fn() },
}));

describe('update fallback behavior', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mockCheckForNativeUpdate.mockReturnValue(false);
    mockHasNativeUpdateFailed.mockReturnValue(false);
    mockCheckForUpdate.mockResolvedValue(null);
    await import('../main');
  });

  afterEach(() => {
    for (const key in ipcHandlers) {
      delete ipcHandlers[key];
    }
  });

  it('skips manual check when native updater is active and has not failed', async () => {
    mockCheckForNativeUpdate.mockReturnValue(true);
    mockHasNativeUpdateFailed.mockReturnValue(false);

    const result = await ipcHandlers['check-for-update']();

    expect(result).toBeNull();
    expect(mockCheckForUpdate).not.toHaveBeenCalled();
  });

  it('falls back to manual check when native updater has failed', async () => {
    mockCheckForNativeUpdate.mockReturnValue(true);
    mockHasNativeUpdateFailed.mockReturnValue(true);
    mockCheckForUpdate.mockResolvedValue({ version: '1.2.0', downloadUrl: 'https://example.com/MNote.dmg' });

    const result = await ipcHandlers['check-for-update']();

    expect(mockCheckForUpdate).toHaveBeenCalledOnce();
    expect(result).toEqual({ version: '1.2.0', downloadUrl: 'https://example.com/MNote.dmg' });
  });

  it('uses manual check when native updater is not active', async () => {
    mockCheckForNativeUpdate.mockReturnValue(false);
    mockCheckForUpdate.mockResolvedValue({ version: '1.2.0', downloadUrl: 'https://example.com/MNote.dmg' });

    const result = await ipcHandlers['check-for-update']();

    expect(mockCheckForUpdate).toHaveBeenCalledOnce();
    expect(result).toEqual({ version: '1.2.0', downloadUrl: 'https://example.com/MNote.dmg' });
  });
});
