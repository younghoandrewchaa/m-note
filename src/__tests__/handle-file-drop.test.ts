import { describe, it, expect, vi } from 'vitest'
import { handleFileDrop } from '../handle-file-drop'

function makeFileList(...files: File[]): FileList {
  return {
    length: files.length,
    item: (i: number) => files[i] ?? null,
    [Symbol.iterator]: files[Symbol.iterator].bind(files),
    ...Object.fromEntries(files.map((f, i) => [i, f])),
  } as unknown as FileList
}

const file = (name: string) => new File(['x'], name)

describe('handleFileDrop', () => {
  it('opens every dropped markdown file', async () => {
    const api = {
      getFilePath: vi.fn((f: File) => `/d/${f.name}`),
      openLocalFile: vi.fn(async () => true),
    }

    await handleFileDrop(makeFileList(file('a.md'), file('b.markdown'), file('c.txt')), api)

    expect(api.openLocalFile).toHaveBeenCalledTimes(2)
    expect(api.openLocalFile).toHaveBeenCalledWith('/d/a.md')
    expect(api.openLocalFile).toHaveBeenCalledWith('/d/b.markdown')
  })

  it('skips files without a native path', async () => {
    const api = { getFilePath: vi.fn(() => ''), openLocalFile: vi.fn(async () => true) }

    await handleFileDrop(makeFileList(file('a.md')), api)

    expect(api.openLocalFile).not.toHaveBeenCalled()
  })

  it('does nothing without electronAPI', async () => {
    await expect(handleFileDrop(makeFileList(file('a.md')), undefined)).resolves.toBeUndefined()
  })
})
