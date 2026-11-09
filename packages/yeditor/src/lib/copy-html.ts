import { getHTMLFromFragment } from "@tiptap/core"
import { Fragment } from "@tiptap/pm/model"
import type { Node as PMNode } from "@tiptap/pm/model"
import type { Editor } from "@tiptap/core"

/** The document as HTML, without the YAML frontmatter node (it is metadata, not content). */
export function getDocumentHtml(editor: Editor): string {
  const nodes: PMNode[] = []
  editor.state.doc.forEach((node) => {
    if (node.type.name !== "frontmatter") nodes.push(node)
  })
  return getHTMLFromFragment(Fragment.fromArray(nodes), editor.schema)
}

/**
 * Puts the HTML on the clipboard as both `text/html` (rich-text apps paste it
 * formatted) and `text/plain` (code editors paste the source).
 */
export async function copyHtmlToClipboard(html: string): Promise<boolean> {
  if (!html) return false
  await navigator.clipboard.write([
    new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([html], { type: "text/plain" }),
    }),
  ])
  return true
}
