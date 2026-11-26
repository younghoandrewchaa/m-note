// Remembers a tab's scroll position across a Cmd+R reload. sessionStorage is
// per window (each tab is its own window) and survives a reload.
const KEY = "m-note:scroll-position"

export function saveScrollPosition(filePath: string, scrollTop: number): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ filePath, scrollTop }))
  } catch {
    // Storage unavailable: losing the position is harmless.
  }
}

/** Returns the saved position if it belongs to `filePath`; always clears it. */
export function takeScrollPosition(filePath: string): number | undefined {
  try {
    const raw = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    if (!raw) return undefined
    const saved = JSON.parse(raw) as { filePath?: unknown; scrollTop?: unknown }
    if (saved.filePath !== filePath || typeof saved.scrollTop !== "number") return undefined
    return saved.scrollTop
  } catch {
    return undefined
  }
}
