import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"

import { FrontmatterNode } from "./frontmatter-node"

export const Frontmatter = Node.create({
  name: "frontmatter",
  group: "block",
  content: "text*",
  code: true,
  defining: true,
  isolating: true,

  // The markdown serializer passes JSON content, so join the text children.
  renderMarkdown(node: { content?: { text?: string }[] }) {
    const text = (node.content ?? []).map((child) => child.text ?? "").join("")
    return `---\n${text}\n---`
  },

  parseHTML() {
    return [{ tag: 'pre[data-type="frontmatter"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "pre",
      mergeAttributes(HTMLAttributes, { "data-type": "frontmatter" }),
      ["code", 0],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(FrontmatterNode)
  },
})

export default Frontmatter
