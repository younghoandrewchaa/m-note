"use client"

import { forwardRef, useCallback, useState, useRef } from "react"

import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { FilePathIcon } from "@/components/tiptap-icons/file-path-icon"
import { CheckIcon } from "@/components/tiptap-icons/check-icon"
import { copyFilePathToClipboard } from "@/lib/copy-file-path"

export interface CopyFilePathButtonProps extends ButtonProps {
  filePath: string | null
}

export const CopyFilePathButton = forwardRef<
  HTMLButtonElement,
  CopyFilePathButtonProps
>(({ filePath, onClick, children, ...buttonProps }, ref) => {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleClick = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event)
      if (event.defaultPrevented) return

      const didCopy = await copyFilePathToClipboard(filePath)
      if (!didCopy) return

      setCopied(true)
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCopied(false), 2000)
    },
    [filePath, onClick]
  )

  return (
    <Button
      type="button"
      variant="ghost"
      role="button"
      tabIndex={-1}
      aria-label="Copy file path"
      tooltip="Copy file path"
      disabled={!filePath}
      onClick={handleClick}
      {...buttonProps}
      ref={ref}
    >
      {children ?? (
        copied ? (
          <CheckIcon className="tiptap-button-icon" />
        ) : (
          <FilePathIcon className="tiptap-button-icon" />
        )
      )}
    </Button>
  )
})

CopyFilePathButton.displayName = "CopyFilePathButton"
