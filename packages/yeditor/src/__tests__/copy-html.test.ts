import { describe, it, expect, vi, beforeEach } from 'vitest'
import { copyHtmlToClipboard } from '../lib/copy-html'

describe('copyHtmlToClipboard', () => {
  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
  })

  it('returns false and does not write to clipboard when html is empty', async () => {
    const result = await copyHtmlToClipboard('')
    expect(result).toBe(false)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('writes the html to the clipboard and returns true', async () => {
    const html = '<h1>Hello world</h1>'
    const result = await copyHtmlToClipboard(html)
    expect(result).toBe(true)
    expect(writeText).toHaveBeenCalledWith(html)
  })

  it('preserves markup content exactly', async () => {
    const html = '<p>Run <code>npm start</code> now</p>'
    await copyHtmlToClipboard(html)
    expect(writeText).toHaveBeenCalledWith(html)
  })
})
