import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { copyHtmlToClipboard } from '../lib/copy-html'

class FakeClipboardItem {
  constructor(public items: Record<string, Blob>) {}
}

describe('copyHtmlToClipboard', () => {
  let write: ReturnType<typeof vi.fn>

  beforeEach(() => {
    write = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { write } })
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function written(): Promise<Record<string, { type: string; text: string }>> {
    const [items] = write.mock.calls[0] as [FakeClipboardItem[]]
    expect(items).toHaveLength(1)
    const out: Record<string, { type: string; text: string }> = {}
    for (const [mime, blob] of Object.entries(items[0].items)) {
      out[mime] = { type: blob.type, text: await blob.text() }
    }
    return out
  }

  it('returns false and does not write to clipboard when html is empty', async () => {
    const result = await copyHtmlToClipboard('')
    expect(result).toBe(false)
    expect(write).not.toHaveBeenCalled()
  })

  it('writes text/html so rich-text apps paste formatted content', async () => {
    const html = '<h1>Hello <strong>world</strong></h1>'
    const result = await copyHtmlToClipboard(html)
    expect(result).toBe(true)
    const items = await written()
    expect(items['text/html']).toEqual({ type: 'text/html', text: html })
  })

  it('also writes the HTML source as text/plain for code editors', async () => {
    const html = '<p>Run <code>npm start</code> now</p>'
    await copyHtmlToClipboard(html)
    const items = await written()
    expect(items['text/plain']).toEqual({ type: 'text/plain', text: html })
  })
})
