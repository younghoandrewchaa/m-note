import type { Editor } from "@tiptap/react"

/**
 * Whether a keyboard shortcut belongs to this editor. Shortcuts are page-wide, so with several
 * editors on a page only the one containing the focused element handles them. With nothing
 * focused, a lone editor (a desktop window) still claims them.
 */
export function isEventForEditor(editor: Editor | null, event: KeyboardEvent): boolean {
  if (!editor || editor.isDestroyed) return false
  let dom: HTMLElement
  try {
    dom = editor.view.dom
  } catch {
    return false
  }
  const wrapper = dom.closest(".yeditor") ?? dom
  const target = event.target instanceof Node ? event.target : null
  if (target && wrapper.contains(target)) return true
  const nothingFocused = !target || target === document.body || target === document.documentElement
  return nothingFocused && document.querySelectorAll(".yeditor").length <= 1
}
