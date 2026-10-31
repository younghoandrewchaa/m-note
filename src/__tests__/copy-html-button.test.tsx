// @vitest-environment jsdom
import { expect, it, vi, beforeEach, afterEach } from 'vitest'
import { describe } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { CopyHtmlButton } from '@/components/tiptap-ui/copy-html-button'

describe('CopyHtmlButton', () => {
  let writeText: ReturnType<typeof vi.fn>
  let editor: Editor

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    })

    editor = new Editor({
      extensions: [StarterKit, Markdown],
      content: '<h1>Hello <strong>world</strong></h1>',
    })
  })

  afterEach(() => {
    editor?.destroy()
    vi.unstubAllGlobals()
  })

  it('renders nothing when there is no editor', () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const host = document.createElement('div')
    const root = createRoot(host)
    act(() => root.render(<CopyHtmlButton editor={null} />))
    expect(host.textContent).toBe('')
    act(() => root.unmount())
  })

  it('copies HTML from editor.getHTML() (not markdown) on click', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const host = document.createElement('div')
    const root = createRoot(host)

    await act(async () => {
      root.render(<CopyHtmlButton editor={editor} />)
    })

    const button = host.querySelector('button')
    expect(button).toBeTruthy()
    expect(button?.getAttribute('aria-label')).toBe('Copy as HTML')

    await act(async () => {
      button!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(writeText).toHaveBeenCalledOnce()
    const copiedHtml = writeText.mock.calls[0][0]
    expect(copiedHtml).toContain('<h1')
    expect(copiedHtml).toContain('Hello <strong>world</strong>')
    // The output is HTML, not markdown.
    expect(copiedHtml).not.toContain('# Hello')

    act(() => root.unmount())
  })

  it('renders a check icon after copying', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENV_ENVIRONMENT', true)
    const host = document.createElement('div')
    const root = createRoot(host)

    await act(async () => {
      root.render(<CopyHtmlButton editor={editor} />)
    })

    const button = host.querySelector('button')!

    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    // After copying, the check icon should be present.
    const checkIcon = host.querySelector('svg')
    expect(checkIcon).not.toBeNull()

    act(() => root.unmount())
  })
})
