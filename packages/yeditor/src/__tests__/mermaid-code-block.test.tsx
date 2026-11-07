// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CodeBlock } from '../components/tiptap-node/code-block-node/code-block-node-extension'

let editor: Editor
let host: HTMLDivElement
let root: Root
function Harness() {
  editor = useEditor({ extensions: [StarterKit.configure({ codeBlock: false }), CodeBlock, Markdown], content: '```mermaid\nflowchart LR\n A[Start] --> B[End]\n```', contentType: 'markdown' })!
  return <EditorContent editor={editor} />
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() => root.render(<Harness />))
  act(() => vi.advanceTimersByTime(150))
})
afterEach(async () => {
  await act(async () => {
    root.unmount()
    vi.runOnlyPendingTimers()
  })
  host.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('renders a loaded Mermaid block while preserving editable source and Markdown', () => {
  expect(host.querySelector('select')?.value).toBe('mermaid')
  expect(host.querySelector('svg')).not.toBeNull()
  expect(host.querySelector('pre code')?.textContent).toBe('flowchart LR\n A[Start] --> B[End]')
  expect(editor.getMarkdown()).toContain('```mermaid')
  expect(editor.getMarkdown()).not.toContain('<svg')
  expect(host.querySelector('.mermaid-preview')?.getAttribute('contenteditable')).toBe('false')
})
it('selects Mermaid from ordinary code and follows undo/redo', () => {
  act(() => editor.commands.setTextSelection(1))
  act(() => editor.commands.updateAttributes('codeBlock', { language: 'typescript' }))
  expect(host.querySelector('select')?.value).toBe('typescript')
  expect(host.querySelector('.mermaid-preview')).toBeNull()
  const select = host.querySelector('select')!
  act(() => {
    select.value = 'mermaid'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  act(() => vi.advanceTimersByTime(150))
  expect(editor.state.doc.firstChild?.attrs.language).toBe('mermaid')
  expect(host.querySelector('svg')).not.toBeNull()
  act(() => editor.commands.undo())
  expect(host.querySelector('select')?.value).toBe(editor.state.doc.firstChild?.attrs.language)
  act(() => editor.commands.redo())
  expect(host.querySelector('select')?.value).toBe('mermaid')
})
it('copies Mermaid source and does not dispatch edits when previews refresh', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const updates = vi.fn()
  editor.on('update', updates)
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Copy code"]')!.click())
  expect(writeText).toHaveBeenCalledWith('flowchart LR\n A[Start] --> B[End]')
  act(() => vi.advanceTimersByTime(2000))
  expect(updates).not.toHaveBeenCalled()
})
it('clears previews when opening a different document', () => {
  act(() => editor.commands.setContent('# Another document', { contentType: 'markdown', emitUpdate: false }))
  act(() => vi.advanceTimersByTime(150))
  expect(host.querySelector('svg')).toBeNull()
  expect(editor.getMarkdown().trim()).toBe('# Another document')
})
