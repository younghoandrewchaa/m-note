"use client"

import { forwardRef, useCallback, useRef, useState } from "react"

import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { RefreshCwIcon } from "@/components/tiptap-icons/refresh-cw-icon"
import { CheckIcon } from "@/components/tiptap-icons/check-icon"

export interface CheckUpdateButtonProps extends ButtonProps {
  onCheckForUpdate?: () => Promise<void>
}

export const CheckUpdateButton = forwardRef<
  HTMLButtonElement,
  CheckUpdateButtonProps
>(({ onCheckForUpdate, onClick, children, ...buttonProps }, ref) => {
  const [checking, setChecking] = useState(false)
  const [checked, setChecked] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleClick = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event)
      if (event.defaultPrevented || !onCheckForUpdate || checking) return

      setChecking(true)
      try {
        await onCheckForUpdate()
      } finally {
        setChecking(false)
        setChecked(true)
        clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => setChecked(false), 2000)
      }
    },
    [onCheckForUpdate, checking, onClick]
  )

  return (
    <Button
      type="button"
      variant="ghost"
      role="button"
      tabIndex={-1}
      aria-label="Check for Updates"
      tooltip="Check for Updates"
      disabled={checking}
      onClick={handleClick}
      {...buttonProps}
      ref={ref}
    >
      {children ??
        (checked ? (
          <CheckIcon className="tiptap-button-icon" />
        ) : (
          <RefreshCwIcon
            className={`tiptap-button-icon${checking ? " tiptap-button-icon-spin" : ""}`}
          />
        ))}
    </Button>
  )
})

CheckUpdateButton.displayName = "CheckUpdateButton"
