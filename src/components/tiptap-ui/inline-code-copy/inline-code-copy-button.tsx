import { useCallback, useEffect, useRef, useState } from "react"
import type { Editor } from "@tiptap/react"
import { ClipboardCopyIcon } from "@/components/tiptap-icons/clipboard-copy-icon"
import { CheckIcon } from "@/components/tiptap-icons/check-icon"
import { copyCodeToClipboard } from "@/lib/copy-code"
import {
  computeButtonPosition,
  findInlineCodeElement,
  type ButtonPosition,
} from "@/lib/inline-code-copy"

/** Must match the button's width/height in inline-code-copy-button.scss. */
const BUTTON_SIZE = 22
/** Grace period so the pointer can travel from the span to the button. */
const HIDE_DELAY_MS = 150
const COPIED_RESET_MS = 2000

export function InlineCodeCopyButton({ editor }: { editor: Editor | null }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [position, setPosition] = useState<ButtonPosition | null>(null)
  const [copied, setCopied] = useState(false)
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  const copiedTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  const hide = useCallback(() => {
    setTarget(null)
    setPosition(null)
    setCopied(false)
  }, [])

  const cancelHide = useCallback(() => {
    clearTimeout(hideTimeout.current)
  }, [])

  const hideSoon = useCallback(() => {
    clearTimeout(hideTimeout.current)
    hideTimeout.current = setTimeout(hide, HIDE_DELAY_MS)
  }, [hide])

  const show = useCallback((element: HTMLElement) => {
    clearTimeout(hideTimeout.current)
    // A wrapped span's bounding rect spans both lines; anchor to the first
    // line box so the button never floats over intervening text.
    const rect = element.getClientRects()[0] ?? element.getBoundingClientRect()
    setTarget(element)
    setPosition(
      computeButtonPosition(rect, BUTTON_SIZE, {
        width: window.innerWidth,
        height: window.innerHeight,
      })
    )
  }, [])

  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom

    function handleMouseOver(event: MouseEvent) {
      const element = findInlineCodeElement(event.target)
      if (!element) return
      show(element)
    }

    function handleMouseOut(event: MouseEvent) {
      if (!findInlineCodeElement(event.target)) return
      hideSoon()
    }

    dom.addEventListener("mouseover", handleMouseOver)
    dom.addEventListener("mouseout", handleMouseOut)
    return () => {
      dom.removeEventListener("mouseover", handleMouseOver)
      dom.removeEventListener("mouseout", handleMouseOut)
    }
  }, [editor, show, hideSoon])

  // While visible: hide on scroll (the fixed position would go stale), and
  // hide if the span was edited out of the document underneath us.
  useEffect(() => {
    if (!target) return
    if (!target.isConnected) {
      hide()
      return
    }
    window.addEventListener("scroll", hide, true)
    return () => window.removeEventListener("scroll", hide, true)
  }, [target, hide])

  useEffect(() => {
    return () => {
      clearTimeout(hideTimeout.current)
      clearTimeout(copiedTimeout.current)
    }
  }, [])

  async function handleCopy() {
    if (!target) return
    try {
      const success = await copyCodeToClipboard(target.textContent ?? "")
      if (!success) return
      setCopied(true)
      clearTimeout(copiedTimeout.current)
      copiedTimeout.current = setTimeout(() => setCopied(false), COPIED_RESET_MS)
    } catch (error) {
      console.error("Failed to copy inline code:", error)
    }
  }

  if (!target || !position) return null

  return (
    <button
      className="inline-code-copy-btn"
      style={{ top: position.top, left: position.left }}
      onMouseEnter={cancelHide}
      onMouseLeave={hideSoon}
      onMouseDown={(event) => event.preventDefault()}
      onClick={handleCopy}
      aria-label="Copy code"
      title="Copy code"
    >
      {copied ? (
        <CheckIcon className="inline-code-copy-icon" />
      ) : (
        <ClipboardCopyIcon className="inline-code-copy-icon" />
      )}
    </button>
  )
}
