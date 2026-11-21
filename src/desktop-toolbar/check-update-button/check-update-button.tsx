"use client"

import { forwardRef, useCallback } from "react"

import type { ButtonProps } from "@younghoandrewchaa/yeditor"
import { Button } from "@younghoandrewchaa/yeditor"
import { RefreshCwIcon } from "@/icons/refresh-cw-icon"

export interface CheckUpdateButtonProps extends ButtonProps {
  updateStatus?: import("@/update-state").UpdateState["status"]
  onCheckForUpdate?: () => Promise<void>
}

export const CheckUpdateButton = forwardRef<
  HTMLButtonElement,
  CheckUpdateButtonProps
>(
  (
    { onCheckForUpdate, updateStatus, onClick, children, ...buttonProps },
    ref,
  ) => {
    const checking = ["checking", "downloading", "installing"].includes(
      updateStatus ?? "",
    )

    const handleClick = useCallback(
      async (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented || !onCheckForUpdate || checking) return

        await onCheckForUpdate()
      },
      [onCheckForUpdate, checking, onClick],
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
        {children ?? (
          <RefreshCwIcon
            className={`tiptap-button-icon${checking ? " tiptap-button-icon-spin" : ""}`}
          />
        )}
      </Button>
    )
  },
)

CheckUpdateButton.displayName = "CheckUpdateButton"
