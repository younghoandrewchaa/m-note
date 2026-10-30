// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { CodeBlock } from '../components/tiptap-node/code-block-node/code-block-node-extension'

const extensions = [StarterKit.configure({ codeBlock: false }), CodeBlock, Markdown]

describe('Code block containing backtick fences', () => {
  it.each([
    ['```python\nprint(1)\n```', '````'],
    ['````\nnested\n````', '`````'],
    ['inline `code` and ``double``', '```'],
  ])('preserves content through import, export and reopen: %s', (source, fence) => {
    const editor = new Editor({ extensions, content: '`````markdown\n' + source + '\n`````', contentType: 'markdown' })
    const markdown = editor.getMarkdown()
    const reopened = new Editor({ extensions, content: markdown, contentType: 'markdown' })
    try {
      expect(markdown.startsWith(fence + 'markdown\n')).toBe(true)
      for (const instance of [editor, reopened]) {
        expect(instance.state.doc.childCount).toBe(1)
        const block = instance.state.doc.firstChild!
        expect(block.type.name).toBe('codeBlock')
        expect(block.attrs.language).toBe('markdown')
        expect(block.textContent).toBe(source)
      }
    } finally {
      editor.destroy()
      reopened.destroy()
    }
  })
})
