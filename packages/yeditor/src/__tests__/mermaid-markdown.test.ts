// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { CodeBlock } from '../components/tiptap-node/code-block-node/code-block-node-extension'

const extensions = [StarterKit.configure({ codeBlock: false }), CodeBlock, Markdown]

describe('Mermaid Markdown preservation', () => {
  it.each([
    'flowchart TD\n  A --> B',
    'sequenceDiagram\n  Alice->>Bob: Hello',
    'not valid Mermaid <script>alert(1)</script>',
    '',
    '---\ntitle: Diagram\n---\nflowchart LR\n  A --> B',
  ])('preserves source through import, export and reopen: %s', (source) => {
    const editor = new Editor({ extensions, content: '```mermaid\n' + source + '\n```', contentType: 'markdown' })
    const reopened = new Editor({ extensions, content: editor.getMarkdown(), contentType: 'markdown' })
    try {
      for (const instance of [editor, reopened]) {
        const block = instance.state.doc.firstChild!
        expect(block.type.name).toBe('codeBlock')
        expect(block.attrs.language).toBe('mermaid')
        expect(block.textContent).toBe(source)
      }
      expect(editor.getMarkdown()).not.toContain('<svg')
    } finally {
      editor.destroy()
      reopened.destroy()
    }
  })

  it('keeps multiple diagrams and ordinary code independent', () => {
    const editor = new Editor({ extensions, content: '```mermaid\nflowchart LR\n A --> B\n```\n\n```typescript\nconst n = 1\n```\n\n```mermaid\nsequenceDiagram\n A->>B: Hi\n```', contentType: 'markdown' })
    try {
      expect(editor.getJSON().content!.filter(node => node.type === 'codeBlock').map(node => node.attrs?.language)).toEqual(['mermaid', 'typescript', 'mermaid'])
      expect(editor.getMarkdown()).toContain('const n = 1')
    } finally { editor.destroy() }
  })
})
