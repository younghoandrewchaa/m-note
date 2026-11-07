import { createContext } from "react"
import { sanitizeUrl } from "@/lib/tiptap-utils"

export interface YEditorConfig {
  onOpenLink: (url: string) => void
}

export function defaultOpenLink(url: string): void {
  const safeUrl = sanitizeUrl(url, window.location.href)
  if (safeUrl === "#") return
  window.open(safeUrl, "_blank", "noopener,noreferrer")
}

export const YEditorConfigContext = createContext<YEditorConfig>({
  onOpenLink: defaultOpenLink,
})
