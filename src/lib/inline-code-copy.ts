/**
 * Returns the inline `<code>` element at `target`, or null.
 *
 * A `<code>` inside a `<pre>` is a code block, which has its own copy button
 * in the code-block node view, so it is deliberately excluded here.
 */
export function findInlineCodeElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const code = target.closest("code")
  if (!code) return null
  if (code.closest("pre")) return null
  return code as HTMLElement
}

export interface PositionRect {
  top: number
  right: number
  bottom: number
  left: number
}

export interface Viewport {
  width: number
  height: number
}

export interface ButtonPosition {
  top: number
  left: number
}

/** Gap in px between the code span and the floating button. */
export const BUTTON_GAP = 4

/**
 * Viewport coordinates for a `position: fixed` square copy button.
 *
 * The button is right-aligned to the span and sits above it, flipping below
 * when there is no room, and clamped so it never leaves the viewport.
 */
export function computeButtonPosition(
  rect: PositionRect,
  buttonSize: number,
  viewport: Viewport
): ButtonPosition {
  const maxLeft = Math.max(viewport.width - buttonSize, 0)
  const left = Math.min(Math.max(rect.right - buttonSize, 0), maxLeft)

  const above = rect.top - buttonSize - BUTTON_GAP
  const top = above >= 0 ? above : rect.bottom + BUTTON_GAP

  return { top, left }
}
