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
