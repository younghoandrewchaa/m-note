import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleFileDrop } from '../handle-file-drop'

class MockFileReader {
  result: string | null = null
  onload: (() => void) | null = null
  readAsText(file: File) {
    file.text().then((text) => {
      this.result = text
      this.onload?.()
    })
  }
}

vi.stubGlobal('FileReader', MockFileReader)

function makeFileList(...files: File[]): FileList {
  return {
    length: files.length,
    item: (i: number) => files[i] ?? null,
    [Symbol.iterator]: files[Symbol.iterator].bind(files),
    ...Object.fromEntries(files.map((f, i) => [i, f])),
  } as unknown as FileList
}

function makeCallbacks() {
  return {
    setContent: vi.fn(),
    setFilePath: vi.fn(),
    setTitle: vi.fn(),
  }
}

describe('handleFileDrop', () => {
  let callbacks: ReturnType<typeof makeCallbacks>

  beforeEach(() => {
    callbacks = makeCallbacks()
  })

  it('uses electronAPI.getFilePath and readFile when path is available', async () => {
    const api = {
      getFilePath: vi.fn().mockReturnValue('/Users/test/doc.md'),
      readFile: vi.fn().mockResolvedValue({ path: '/Users/test/doc.md', content: '# Hello' }),
    }
    const file = new File(['# Hello'], 'doc.md', { type: 'text/markdown' })

    handleFileDrop(makeFileList(file), api, callbacks)

    expect(api.getFilePath).toHaveBeenCalledWith(file)
    expect(api.readFile).toHaveBeenCalledWith('/Users/test/doc.md')

    await vi.waitFor(() => expect(callbacks.setContent).toHaveBeenCalledWith('# Hello'))
    expect(callbacks.setFilePath).toHaveBeenCalledWith('/Users/test/doc.md')
    expect(callbacks.setTitle).toHaveBeenCalledWith('doc.md')
  })

  it('falls back to FileReader when electronAPI is undefined', async () => {
    const file = new File(['# Fallback'], 'notes.md', { type: 'text/markdown' })

    handleFileDrop(makeFileList(file), undefined, callbacks)

    await vi.waitFor(() => expect(callbacks.setContent).toHaveBeenCalledWith('# Fallback'))
    expect(callbacks.setTitle).toHaveBeenCalledWith('notes.md')
    expect(callbacks.setFilePath).not.toHaveBeenCalled()
  })

  it('does nothing when no markdown file is in the list', () => {
    const file = new File(['data'], 'image.png', { type: 'image/png' })
    const api = {
      getFilePath: vi.fn(),
      readFile: vi.fn(),
    }

    handleFileDrop(makeFileList(file), api, callbacks)

    expect(api.getFilePath).not.toHaveBeenCalled()
    expect(callbacks.setContent).not.toHaveBeenCalled()
  })

  it('calls api.setFilePath with the native path after reading the file', async () => {
    const api = {
      getFilePath: vi.fn().mockReturnValue('/Users/test/doc.md'),
      readFile: vi.fn().mockResolvedValue({ path: '/Users/test/doc.md', content: '# Hello' }),
      setFilePath: vi.fn(),
    }
    const file = new File(['# Hello'], 'doc.md', { type: 'text/markdown' })

    handleFileDrop(makeFileList(file), api, callbacks)

    await vi.waitFor(() => expect(api.setFilePath).toHaveBeenCalledWith('/Users/test/doc.md'))
  })

  it('falls back to FileReader when getFilePath returns empty string', async () => {
    const api = {
      getFilePath: vi.fn().mockReturnValue(''),
      readFile: vi.fn(),
    }
    const file = new File(['# Empty path'], 'test.md', { type: 'text/markdown' })

    handleFileDrop(makeFileList(file), api, callbacks)

    expect(api.readFile).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(callbacks.setContent).toHaveBeenCalledWith('# Empty path'))
    expect(callbacks.setFilePath).not.toHaveBeenCalled()
  })

  it('checks for updates after successfully loading a dropped file', async () => {
    const api = {
      getFilePath: vi.fn().mockReturnValue('/Users/test/doc.md'),
      readFile: vi.fn().mockResolvedValue({ path: '/Users/test/doc.md', content: '# Hello' }),
      checkForUpdate: vi.fn().mockResolvedValue(null),
    }
    const file = new File(['# Hello'], 'doc.md', { type: 'text/markdown' })

    handleFileDrop(makeFileList(file), api, callbacks)

    await vi.waitFor(() => expect(api.checkForUpdate).toHaveBeenCalled())
  })
})
