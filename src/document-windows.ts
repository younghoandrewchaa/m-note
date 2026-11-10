import type { BrowserWindow } from 'electron'
import { chooseOpenTarget, nextUntitledNumber, tabTitle, type TabDocument } from './document-tabs'

export interface DocumentWindows {
  open(filePath: string, anchor?: BrowserWindow | null): BrowserWindow
  newTab(anchor?: BrowserWindow | null): BrowserWindow
  setFilePath(webContentsId: number, filePath: string): void
  setDirty(webContentsId: number, dirty: boolean): void
  filePathOf(window: BrowserWindow): string | null
  isDirty(window: BrowserWindow): boolean
  anchor(): BrowserWindow | null
}

interface Entry { window: BrowserWindow; doc: TabDocument }

// Each document is its own BrowserWindow; windows sharing a tabbingIdentifier
// are grouped into one native macOS tab bar.
export function createDocumentWindows(makeWindow: () => BrowserWindow): DocumentWindows {
  // Keyed by webContents.id, in registration order.
  const entries = new Map<number, Entry>()
  let lastFocused: BrowserWindow | null = null

  const docs = () => [...entries.values()].map((entry) => entry.doc)
  const entryOf = (window: BrowserWindow | null | undefined) =>
    [...entries.values()].find((entry) => entry.window === window)
  const updateTitle = ({ window, doc }: Entry) => window.setTitle(tabTitle(doc))

  const anchor = (): BrowserWindow | null => {
    if (lastFocused && !lastFocused.isDestroyed()) return lastFocused
    const windows = [...entries.values()].map((entry) => entry.window).reverse()
    return windows.find((window) => !window.isDestroyed()) ?? null
  }

  const create = (doc: Omit<TabDocument, 'id'>, explicitAnchor?: BrowserWindow | null) => {
    const tabAnchor = explicitAnchor ?? anchor()
    const window = makeWindow()
    const id = window.webContents.id
    const entry: Entry = { window, doc: { ...doc, id } }
    entries.set(id, entry)

    window.on('focus', () => { lastFocused = window })
    window.on('closed', () => {
      entries.delete(id)
      if (lastFocused === window) lastFocused = null
    })
    window.on('page-title-updated', (event) => event.preventDefault())
    // Sent on every load so Cmd+R reload restores the document.
    window.webContents.on('did-finish-load', () => {
      if (entry.doc.filePath) window.webContents.send('file-opened', entry.doc.filePath)
    })

    updateTitle(entry)
    tabAnchor?.addTabbedWindow(window)
    return window
  }

  const update = (webContentsId: number, change: Partial<TabDocument>) => {
    const entry = entries.get(webContentsId)
    if (!entry) return
    Object.assign(entry.doc, change)
    updateTitle(entry)
  }

  return {
    open: (filePath, explicitAnchor) => {
      const tabAnchor = explicitAnchor ?? anchor()
      const target = chooseOpenTarget(filePath, docs(), entryOf(tabAnchor)?.doc.id ?? null)
      const entry = target.kind === 'new' ? undefined : entries.get(target.id)
      if (!entry) return create({ filePath, dirty: false, untitledNumber: null }, tabAnchor)
      const { window } = entry
      if (target.kind === 'reuse') {
        update(entry.doc.id, { filePath, untitledNumber: null })
        if (!window.webContents.isLoading()) window.webContents.send('file-opened', filePath)
      }
      window.focus()
      return window
    },
    newTab: (explicitAnchor) =>
      create({ filePath: null, dirty: false, untitledNumber: nextUntitledNumber(docs()) }, explicitAnchor),
    setFilePath: (webContentsId, filePath) => update(webContentsId, { filePath, untitledNumber: null }),
    setDirty: (webContentsId, dirty) => update(webContentsId, { dirty }),
    filePathOf: (window) => entryOf(window)?.doc.filePath ?? null,
    isDirty: (window) => entryOf(window)?.doc.dirty ?? false,
    anchor,
  }
}
