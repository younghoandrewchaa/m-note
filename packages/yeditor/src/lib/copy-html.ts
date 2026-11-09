import { getHTMLFromFragment } from "@tiptap/core"
import { Fragment } from "@tiptap/pm/model"
import type { Editor } from "@tiptap/core"

/** The document as HTML, without the YAML frontmatter node (it is metadata, not content). */
export function getDocumentHtml(editor: Editor): string {
  const nodes: Parameters<typeof Fragment.fromArray>[0] = []
  editor.state.doc.forEach((node) => {
    if (node.type.name !== "frontmatter") nodes.push(node)
  })
  return getHTMLFromFragment(Fragment.fromArray(nodes), editor.schema)
}

export async function copyHtmlToClipboard(html: string): Promise<boolean> {
  if (!html) return false
  await navigator.clipboard.writeText(html)
  return true
}
