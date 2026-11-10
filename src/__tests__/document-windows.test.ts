import { EventEmitter } from 'node:events'
import type { BrowserWindow } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDocumentWindows, type DocumentWindows } from '../document-windows'

interface FakeWindow extends EventEmitter {
  webContents: EventEmitter & {
    id: number
    send: ReturnType<typeof vi.fn>
    isLoading: ReturnType<typeof vi.fn>
  }
  addTabbedWindow: ReturnType<typeof vi.fn>
  focus: ReturnType<typeof vi.fn>
  setTitle: ReturnType<typeof vi.fn>
  isDestroyed: ReturnType<typeof vi.fn>
}

function fakeWindow(id: number): FakeWindow {
  return Object.assign(new EventEmitter(), {
    webContents: Object.assign(new EventEmitter(), {
      id,
      send: vi.fn(),
      isLoading: vi.fn(() => false),
    }),
    addTabbedWindow: vi.fn(),
    focus: vi.fn(),
    setTitle: vi.fn(),
    isDestroyed: vi.fn(() => false),
  })
}

const a = '/notes/a.md'
const b = '/notes/b.md'
const c = '/notes/c.md'

let nextId: number
let makeWindow: ReturnType<typeof vi.fn<() => BrowserWindow>>
let documents: DocumentWindows

const fake = (window: BrowserWindow) => window as unknown as FakeWindow
const title = (window: BrowserWindow) => fake(window).setTitle.mock.lastCall?.[0]

beforeEach(() => {
  nextId = 1
  makeWindow = vi.fn(() => fakeWindow(nextId++) as unknown as BrowserWindow)
  documents = createDocumentWindows(makeWindow)
})

describe('document windows', () => {
  it('opens a second file as a tab of the first', () => {
    const first = documents.open(a)
    const second = documents.open(b)
    expect(makeWindow).toHaveBeenCalledTimes(2)
    expect(fake(first).addTabbedWindow).toHaveBeenCalledWith(second)
    expect(title(second)).toBe('b.md')
  })

  it('focuses the tab that already has the file', () => {
    const first = documents.open(a)
    documents.open(b)
    documents.open(a)
    expect(makeWindow).toHaveBeenCalledTimes(2)
    expect(fake(first).focus).toHaveBeenCalled()
  })

  it('loads a file into an unedited untitled tab', () => {
    const tab = documents.newTab()
    documents.open(a)
    expect(makeWindow).toHaveBeenCalledTimes(1)
    expect(fake(tab).webContents.send).toHaveBeenCalledWith('file-opened', a)
    expect(title(tab)).toBe('a.md')
  })

  it('defers file-opened until a reused tab finishes loading', () => {
    const tab = documents.newTab()
    fake(tab).webContents.isLoading.mockReturnValue(true)
    documents.open(a)
    expect(fake(tab).webContents.send).not.toHaveBeenCalled()
    fake(tab).webContents.emit('did-finish-load')
    expect(fake(tab).webContents.send).toHaveBeenCalledWith('file-opened', a)
  })

  it('numbers untitled tabs and reuses freed numbers', () => {
    const first = documents.newTab()
    const second = documents.newTab()
    expect(title(first)).toBe('Untitled')
    expect(title(second)).toBe('Untitled 2')
    fake(first).emit('closed')
    expect(title(documents.newTab())).toBe('Untitled')
  })

  it('clears an untitled tab dirty flag when it reloads', () => {
    const tab = documents.newTab()
    documents.setDirty(fake(tab).webContents.id, true)
    expect(title(tab)).toBe('● Untitled')
    fake(tab).webContents.emit('did-finish-load')
    expect(title(tab)).toBe('Untitled')
    expect(documents.isDirty(tab)).toBe(false)
  })

  it('keeps a saved document dirty flag on reload', () => {
    const tab = documents.open(a)
    documents.setDirty(fake(tab).webContents.id, true)
    fake(tab).webContents.emit('did-finish-load')
    expect(documents.isDirty(tab)).toBe(true)
    expect(title(tab)).toBe('● a.md')
  })

  it('shows unsaved changes in the title', () => {
    const window = documents.open(a)
    const id = fake(window).webContents.id
    documents.setDirty(id, true)
    expect(title(window)).toBe('● a.md')
    documents.setDirty(id, false)
    expect(title(window)).toBe('a.md')
  })

  it('saving an untitled tab renames it', () => {
    const window = documents.newTab()
    documents.setFilePath(fake(window).webContents.id, a)
    expect(title(window)).toBe('a.md')
    expect(documents.filePathOf(window)).toBe(a)
  })

  it('prefers the explicit anchor', () => {
    const windowA = documents.open(a)
    const windowB = documents.open(b)
    fake(windowB).emit('focus')
    documents.open(c, windowA)
    expect(fake(windowA).addTabbedWindow).toHaveBeenCalled()
    expect(fake(windowB).addTabbedWindow).not.toHaveBeenCalled()
  })

  it('falls back when the last focused window has closed', () => {
    const windowA = documents.open(a)
    const windowB = documents.open(b)
    fake(windowB).emit('focus')
    fake(windowB).isDestroyed.mockReturnValue(true)
    fake(windowB).emit('closed')
    fake(windowA).addTabbedWindow.mockClear()
    const windowC = documents.open(c)
    expect(fake(windowA).addTabbedWindow).toHaveBeenCalledWith(windowC)
    expect(fake(windowB).addTabbedWindow).not.toHaveBeenCalled()
  })

  it('cancels page title updates', () => {
    const window = documents.open(a)
    const preventDefault = vi.fn()
    fake(window).emit('page-title-updated', { preventDefault })
    expect(preventDefault).toHaveBeenCalled()
  })
})
