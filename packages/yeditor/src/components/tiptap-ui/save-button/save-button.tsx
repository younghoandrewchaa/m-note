"use client"

import { forwardRef, useState, useRef, useCallback } from "react"

import type { ButtonProps } from "../../tiptap-ui-primitive/button"
import { Button } from "../../tiptap-ui-primitive/button"
import { SaveIcon } from "../../tiptap-icons/save-icon"
import { CheckIcon } from "../../tiptap-icons/check-icon"

export interface SaveButtonProps extends ButtonProps {
  onSave?: () => Promise<void>
  canSave?: boolean
}

export const SaveButton = forwardRef<HTMLButtonElement, SaveButtonProps>(
  ({ onSave, canSave = false, onClick, children, ...buttonProps }, ref) => {
    const [saved, setSaved] = useState(false)
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    const handleClick = useCallback(
      async (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented || !onSave || !canSave) return

        await onSave()

        setSaved(true)
        clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => setSaved(false), 2000)
      },
      [onSave, canSave, onClick],
    )

    return (
      <Button
        type="button"
        variant="ghost"
        role="button"
        tabIndex={-1}
        aria-label="Save"
        tooltip="Save"
        disabled={!canSave}
        data-style="ghost"
        onClick={handleClick}
        {...buttonProps}
        ref={ref}
      >
        {children ??
          (saved ? (
            <CheckIcon className="tiptap-button-icon" />
          ) : (
            <SaveIcon className="tiptap-button-icon" />
          ))}
      </Button>
    )
  },
)

SaveButton.displayName = "SaveButton"
