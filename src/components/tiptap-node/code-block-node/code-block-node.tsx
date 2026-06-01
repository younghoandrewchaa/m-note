import { useEffect, useRef, useState } from "react"
import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react"
import { ClipboardCopyIcon } from "@/components/tiptap-icons/clipboard-copy-icon"
import { CheckIcon } from "@/components/tiptap-icons/check-icon"
import { copyCodeToClipboard } from "@/lib/copy-code"

export function CodeBlockNode({
  node,
  updateAttributes,
  extension,
}: ReactNodeViewProps) {
  const defaultLanguage = node.attrs.language as string | null
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current)
  }, [])

  async function handleCopy() {
    const success = await copyCodeToClipboard(node.textContent)
    if (!success) return
    setCopied(true)
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <NodeViewWrapper className="code-block">
      <div className="code-block-controls" contentEditable={false}>
        <button
          className="code-block-copy-btn"
          onClick={handleCopy}
          aria-label="Copy code"
          title="Copy code"
        >
          {copied ? (
            <CheckIcon className="code-block-copy-icon" />
          ) : (
            <ClipboardCopyIcon className="code-block-copy-icon" />
          )}
        </button>
        <select
          defaultValue={defaultLanguage ?? "null"}
          onChange={(event) => updateAttributes({ language: event.target.value })}
        >
          <option value="null">auto</option>
          <option disabled>—</option>
          {(extension.options.lowlight.listLanguages() as string[]).map((lang: string, index: number) => (
            <option key={index} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </div>
      <pre>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <NodeViewContent as={"code" as any} />
      </pre>
    </NodeViewWrapper>
  )
}
