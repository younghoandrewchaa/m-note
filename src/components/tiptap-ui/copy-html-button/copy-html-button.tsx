"use client"

import { forwardRef, useCallback, useState, useRef } from "react"
import type { Editor } from "@tiptap/react"

import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { ClipboardHtmlCopyIcon } from "@/components/tiptap-icons/clipboard-html-copy-icon"
import { CheckIcon } from "@/components/tiptap-icons/check-icon"
import { copyHtmlToClipboard } from "@/lib/copy-html"

export interface CopyHtmlButtonProps extends ButtonProps {
  editor?: Editor | null
}

export const CopyHtmlButton = forwardRef<
  HTMLButtonElement,
  CopyHtmlButtonProps
>(({ editor: providedEditor, onClick, children, ...buttonProps }, ref) => {
    const { editor } = useTiptapEditor(providedEditor)
    const [copied, setCopied] = useState(false)
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    const handleClick = useCallback(
      async (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented || !editor) return

        const html = editor.getHTML()
        const didCopy = await copyHtmlToClipboard(html)
        if (!didCopy) return

        setCopied(true)
        clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => setCopied(false), 2000)
      },
      [editor, onClick]
    )

    if (!editor) return null

    return (
      <Button
        type="button"
        variant="ghost"
        role="button"
        tabIndex={-1}
        aria-label="Copy as HTML"
        tooltip="Copy as HTML"
        onClick={handleClick}
        {...buttonProps}
        ref={ref}
      >
        {children ?? (
          copied ? (
            <CheckIcon className="tiptap-button-icon" />
          ) : (
            <ClipboardHtmlCopyIcon className="tiptap-button-icon" />
          )
        )}
      </Button>
    )
  }
)

CopyHtmlButton.displayName = "CopyHtmlButton"
