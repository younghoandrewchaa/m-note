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

const USER_INPUT = ["wheel", "touchstart", "pointerdown", "keydown"] as const

/**
 * Scrolls `scroller` to `target` on the next frame. Images and diagrams that
 * size late can leave the page too short at first, so the position is
 * re-applied whenever `content` resizes, until it is reached, the user
 * scrolls or types, or `settleMs` passes. Returns a function that stops it.
 */
export function restoreScrollTop(
  scroller: HTMLElement,
  content: HTMLElement,
  target: number,
  settleMs = 3000,
): () => void {
  let done = false
  const observer =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => apply())
  const timer = setTimeout(() => stop(), settleMs)

  function stop() {
    if (done) return
    done = true
    observer?.disconnect()
    clearTimeout(timer)
    for (const type of USER_INPUT) scroller.removeEventListener(type, stop)
  }

  function apply() {
    if (done) return
    scroller.scrollTop = target
    if (scroller.scrollTop >= target - 1) stop()
  }

  for (const type of USER_INPUT) scroller.addEventListener(type, stop, { passive: true })
  requestAnimationFrame(() => {
    apply()
    if (!done) observer?.observe(content)
  })
  return stop
}
