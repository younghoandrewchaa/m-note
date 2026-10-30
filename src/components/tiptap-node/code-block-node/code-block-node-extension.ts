import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { all, createLowlight } from "lowlight"

import { CodeBlockNode } from "./code-block-node"

const lowlight = createLowlight(all)

export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNode)
  },

  // The fence must be longer than any backtick run at the start of a content line,
  // otherwise nested fences (e.g. a markdown snippet containing ```python) close the block early.
  renderMarkdown(node, h) {
    const language = node.attrs?.language || ""
    const content = node.content ? h.renderChildren(node.content) : ""
    const longestRun = Math.max(
      0,
      ...(content.match(/^ {0,3}`+/gm) ?? []).map((run) => run.trim().length)
    )
    const fence = "`".repeat(Math.max(3, longestRun + 1))
    return [`${fence}${language}`, content, fence].join("\n")
  },
}).configure({ lowlight })
