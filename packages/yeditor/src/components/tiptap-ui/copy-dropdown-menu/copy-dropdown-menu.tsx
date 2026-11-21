"use client"

import { useEffect, useRef, useState } from "react"
import { useCurrentEditor } from "@tiptap/react"
import { CheckIcon } from "../../tiptap-icons/check-icon"
import { ClipboardCopyIcon } from "../../tiptap-icons/clipboard-copy-icon"
import { ChevronDownIcon } from "../../tiptap-icons/chevron-down-icon"
import { Button } from "../../tiptap-ui-primitive/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../tiptap-ui-primitive/dropdown-menu"
import "./copy-dropdown-menu.scss"

const copyOptions = [
  ["markdown", "Copy as Markdown"],
  ["source", "Copy HTML source"],
  ["formatted", "Copy formatted content"],
] as const

type CopyFormat = (typeof copyOptions)[number][0]

export function CopyDropdownMenu() {
  const { editor } = useCurrentEditor()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)
  const [pending, setPending] = useState(false)
  const copying = useRef(false)
  const mounted = useRef(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(timeoutRef.current)
    }
  }, [])

  async function copy(format: CopyFormat) {
    if (!editor || copying.current) return
    copying.current = true
    setPending(true)
    setError(false)
    setCopied(false)
    clearTimeout(timeoutRef.current)

    try {
      // Serialize the document, excluding node-view controls and previews.
      if (format === "formatted") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([editor.getHTML()], { type: "text/html" }),
            "text/plain": new Blob([editor.getText()], { type: "text/plain" }),
          }),
        ])
      } else {
        const text = format === "markdown" ? editor.getMarkdown() : editor.getHTML()
        await navigator.clipboard.writeText(text)
      }

      if (!mounted.current) return
      setOpen(false)
      setCopied(true)
      timeoutRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      if (mounted.current) setError(true)
    } finally {
      copying.current = false
      if (mounted.current) setPending(false)
    }
  }

  if (!editor) return null

  return (
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        setError(false)
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          tabIndex={-1}
          aria-label={copied ? "Copied" : "Copy as…"}
          tooltip={copied ? "Copied" : "Copy as…"}
        >
          {copied ? (
            <CheckIcon className="tiptap-button-icon" />
          ) : (
            <ClipboardCopyIcon className="tiptap-button-icon" />
          )}
          <ChevronDownIcon className="tiptap-button-dropdown-small" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        aria-label="Copy as…"
        // Use Radix's focus restoration, including its outside-interaction guard.
        onCloseAutoFocus={undefined}
      >
        <DropdownMenuGroup>
          {copyOptions.map(([format, label]) => (
            <DropdownMenuItem
              key={format}
              asChild
              disabled={pending}
              onSelect={(event) => {
                // Keep the menu available for retry until the write succeeds.
                event.preventDefault()
                void copy(format)
              }}
            >
              <Button type="button" variant="ghost" disabled={pending}>
                <span className="tiptap-button-text">{label}</span>
              </Button>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {error && (
          <p role="alert" className="copy-menu-error">
            Could not copy. Please try again.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
