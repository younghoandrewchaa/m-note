import { beforeEach, describe, expect, it, vi } from 'vitest'

type MockBrowserWindowOptions = Record<string, unknown>
type MockBounds = { x: number; y: number; width: number; height: number }

const appHandlers: Record<string, (...args: any[]) => void> = {}
const browserWindowOptions: MockBrowserWindowOptions[] = []
const mockGetBounds = vi.fn<() => MockBounds>()
const windowListeners: Record<string, Array<() => void>> = {}

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/user/data'),
    on: (event: string, cb: (...args: any[]) => void) => {
      appHandlers[event] = cb
    },
    quit: vi.fn(),
  },
  BrowserWindow: class MockBW {
    webContents = { id: 1, on: vi.fn(), send: vi.fn() };
    constructor(options: MockBrowserWindowOptions) {
      browserWindowOptions.push(options);
    }
    getBounds = mockGetBounds;
    on(event: string, cb: () => void) {
      (windowListeners[event] ??= []).push(cb);
    }
    loadURL() {}
    loadFile() {}
    static getAllWindows() { return []; }
  },
  ipcMain: { handle: vi.fn() },
  screen: {
    getPrimaryDisplay: () => ({ workAreaSize: { width: 1440, height: 900 } }),
    getAllDisplays: () => [
      { workArea: { x: 0, y: 0, width: 1440, height: 900 } },
    ],
  },
  session: { defaultSession: { webRequest: { onHeadersReceived: vi.fn() } } },
  shell: { openExternal: vi.fn() },
}))

vi.mock('electron-squirrel-startup', () => ({ default: false }));
vi.mock('../auto-updater', () => ({
  checkForNativeUpdate: vi.fn(() => false),
  configureAutoUpdater: vi.fn(),
  hasNativeUpdateFailed: vi.fn(() => false),
  installNativeUpdate: vi.fn(),
}));
vi.mock('../update-checker', () => ({ checkForUpdate: vi.fn() }));
vi.mock('../window-close-handler', () => ({ attachCloseHandler: vi.fn() }));
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    promises: { readFile: vi.fn(), writeFile: vi.fn() },
    readFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));
vi.mock('node:path', () => ({
  default: { join: (...parts: string[]) => parts.join('/') },
}));

async function importFreshMain() {
  vi.resetModules();
  browserWindowOptions.length = 0;
  Object.keys(appHandlers).forEach((key) => delete appHandlers[key]);
  Object.keys(windowListeners).forEach((key) => delete windowListeners[key]);
  (globalThis as Record<string, unknown>).MAIN_WINDOW_VITE_DEV_SERVER_URL = undefined;
  (globalThis as Record<string, unknown>).MAIN_WINDOW_VITE_NAME = 'main_window';
  await import('../main');
}

describe('remember window position', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses default half-screen bounds when no saved state exists', async () => {
    await importFreshMain();

    appHandlers.ready();

    expect(browserWindowOptions[0]).toEqual(expect.objectContaining({
      x: 0,
      y: 0,
      width: 720,
      height: 900,
    }));
  });

  it('uses valid saved bounds for newly created windows', async () => {
    await importFreshMain();
    const fs = await import('node:fs');
    vi.mocked(fs.default.existsSync).mockReturnValue(true);
    vi.mocked(fs.default.readFileSync).mockReturnValue(
      JSON.stringify({ x: 80, y: 90, width: 1000, height: 760 }),
    );

    appHandlers.ready();

    expect(browserWindowOptions[0]).toEqual(expect.objectContaining({
      x: 80,
      y: 90,
      width: 1000,
      height: 760,
    }));
  });

  it('falls back when saved bounds are off-screen', async () => {
    await importFreshMain();
    const fs = await import('node:fs');
    vi.mocked(fs.default.existsSync).mockReturnValue(true);
    vi.mocked(fs.default.readFileSync).mockReturnValue(
      JSON.stringify({ x: 2000, y: 100, width: 1000, height: 760 }),
    );

    appHandlers.ready();

    expect(browserWindowOptions[0]).toEqual(expect.objectContaining({
      x: 0,
      y: 0,
      width: 720,
      height: 900,
    }));
  });
});