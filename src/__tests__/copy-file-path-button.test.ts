import { describe, it, expect, vi, beforeEach } from 'vitest'
import { copyFilePathToClipboard } from '../lib/copy-file-path'

describe('copyFilePathToClipboard', () => {
  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
  })

  it('returns false and does not write to clipboard when filePath is null', async () => {
    const result = await copyFilePathToClipboard(null)
    expect(result).toBe(false)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('writes the file path to the clipboard and returns true', async () => {
    const filePath = '/Users/test/document.md'
    const result = await copyFilePathToClipboard(filePath)
    expect(result).toBe(true)
    expect(writeText).toHaveBeenCalledWith(filePath)
  })

  it('writes paths with spaces and special characters correctly', async () => {
    const filePath = '/Users/test/my notes/2026-06-01 daily.md'
    await copyFilePathToClipboard(filePath)
    expect(writeText).toHaveBeenCalledWith(filePath)
  })
})
