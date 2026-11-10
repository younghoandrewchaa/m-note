// @vitest-environment jsdom
import { expect, it, vi, beforeEach, afterEach } from 'vitest'
import { describe } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { CopyHtmlButton } from '../components/tiptap-ui/copy-html-button'
import { Frontmatter } from '../components/tiptap-node/frontmatter-node/frontmatter-node-extension'
import { setMarkdownWithFrontmatter } from '../set-markdown'

class FakeClipboardItem {
  constructor(public items: Record<string, Blob>) {}
}

describe('CopyHtmlButton', () => {
  let write: ReturnType<typeof vi.fn>

  // The text/html payload of the first clipboard write.
  async function copiedHtmlOf(): Promise<string> {
    const [items] = write.mock.calls[0] as [FakeClipboardItem[]]
    return items[0].items['text/html'].text()
  }
  let editor: Editor

  beforeEach(() => {
    write = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { write },
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

    expect(write).toHaveBeenCalledOnce()
    const copiedHtml = await copiedHtmlOf()
    expect(copiedHtml).toContain('<h1')
    expect(copiedHtml).toContain('Hello <strong>world</strong>')
    // The output is HTML, not markdown.
    expect(copiedHtml).not.toContain('# Hello')

    act(() => root.unmount())
  })

  it('leaves YAML frontmatter out of the copied HTML', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const fmEditor = new Editor({ extensions: [StarterKit, Markdown, Frontmatter] })
    setMarkdownWithFrontmatter(fmEditor, '---\ntitle: Secret\ntags: [a]\n---\n# Hello')
    expect(fmEditor.getHTML()).toContain('data-type="frontmatter"')

    const host = document.createElement('div')
    const root = createRoot(host)
    await act(async () => {
      root.render(<CopyHtmlButton editor={fmEditor} />)
    })

    await act(async () => {
      host.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    const copiedHtml = await copiedHtmlOf()
    expect(copiedHtml).not.toContain('frontmatter')
    expect(copiedHtml).not.toContain('title: Secret')
    expect(copiedHtml).toContain('<h1>Hello</h1>')

    act(() => root.unmount())
    fmEditor.destroy()
  })

  it('swaps the clipboard icon for the check icon after copying', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const host = document.createElement('div')
    const root = createRoot(host)

    await act(async () => {
      root.render(<CopyHtmlButton editor={editor} />)
    })

    const button = host.querySelector('button')!
    const iconBefore = button.querySelector('svg')!.outerHTML

    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    // Both icons are SVGs, so compare markup to tell them apart.
    const iconAfter = button.querySelector('svg')!.outerHTML
    expect(iconAfter).not.toBe(iconBefore)

    act(() => root.unmount())
  })
})
