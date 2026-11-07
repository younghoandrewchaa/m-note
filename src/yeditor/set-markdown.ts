import type { Editor } from "@tiptap/react"
import { extractFrontmatter } from "@/lib/frontmatter"

/** Replaces the document with markdown, turning a leading `---` block into a frontmatter node. Does not emit an update. */
export function setMarkdownWithFrontmatter(editor: Editor, markdown: string): void {
  const { frontmatter, body } = extractFrontmatter(markdown)
  editor.commands.setContent(body, {
    emitUpdate: false,
    contentType: "markdown",
  })
  if (frontmatter !== null) {
    editor
      .chain()
      .setMeta("addToHistory", false)
      .setMeta("preventUpdate", true)
      .insertContentAt(0, {
        type: "frontmatter",
        content: frontmatter ? [{ type: "text", text: frontmatter }] : [],
      })
      .run()
  }
}
