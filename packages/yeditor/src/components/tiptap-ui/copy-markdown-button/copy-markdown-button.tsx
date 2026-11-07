"use client"

import { forwardRef, useCallback, useState, useRef } from "react"
import type { Editor } from "@tiptap/react"

import { useTiptapEditor } from "../../../hooks/use-tiptap-editor"

import type { ButtonProps } from "../../tiptap-ui-primitive/button"
import { Button } from "../../tiptap-ui-primitive/button"
import { ClipboardCopyIcon } from "../../tiptap-icons/clipboard-copy-icon"
import { CheckIcon } from "../../tiptap-icons/check-icon"

export interface CopyMarkdownButtonProps extends ButtonProps {
  editor?: Editor | null
}

export const CopyMarkdownButton = forwardRef<
  HTMLButtonElement,
  CopyMarkdownButtonProps
>(({ editor: providedEditor, onClick, children, ...buttonProps }, ref) => {
    const { editor } = useTiptapEditor(providedEditor)
    const [copied, setCopied] = useState(false)
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    const handleClick = useCallback(
      async (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented || !editor) return

        const markdown = (editor as any).getMarkdown() as string
        await navigator.clipboard.writeText(markdown)

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
        aria-label="Copy as Markdown"
        tooltip="Copy as Markdown"
        onClick={handleClick}
        {...buttonProps}
        ref={ref}
      >
        {children ?? (
          copied ? (
            <CheckIcon className="tiptap-button-icon" />
          ) : (
            <ClipboardCopyIcon className="tiptap-button-icon" />
          )
        )}
      </Button>
    )
  }
)

CopyMarkdownButton.displayName = "CopyMarkdownButton"
