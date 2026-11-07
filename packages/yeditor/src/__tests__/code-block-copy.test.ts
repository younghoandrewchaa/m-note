import { describe, it, expect, vi, beforeEach } from 'vitest'
import { copyCodeToClipboard } from '../lib/copy-code'

describe('copyCodeToClipboard', () => {
  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
  })

  it('writes the code text to the clipboard and returns true', async () => {
    const code = 'const x = 1\nconsole.log(x)'
    const result = await copyCodeToClipboard(code)
    expect(result).toBe(true)
    expect(writeText).toHaveBeenCalledWith(code)
  })

  it('returns false and does not write to clipboard when code is empty string', async () => {
    const result = await copyCodeToClipboard('')
    expect(result).toBe(false)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('preserves whitespace and newlines exactly', async () => {
    const code = '  function foo() {\n    return 42\n  }\n'
    await copyCodeToClipboard(code)
    expect(writeText).toHaveBeenCalledWith(code)
  })
})
