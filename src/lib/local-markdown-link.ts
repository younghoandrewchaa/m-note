/**
 * Returns true when the URL looks like a local markdown file path
 * (no http/https/etc protocol, extension is .md or .markdown).
 */
export function isLocalMarkdownLink(url: string): boolean {
  if (!url) return false
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return false
  return /\.(md|markdown)$/i.test(url)
}

/**
 * Resolves a local markdown URL against the directory of the currently open file.
 * Absolute paths are returned unchanged. Relative paths are resolved relative to
 * the directory of currentFilePath. When currentFilePath is null the raw url is returned.
 */
export function resolveLocalMarkdownPath(
  url: string,
  currentFilePath: string | null | undefined
): string {
  if (url.startsWith('/')) return url
  if (!currentFilePath) return url
  const dir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'))
  const combined = dir + '/' + url
  const parts = combined.split('/')
  const resolved: string[] = []
  for (const part of parts) {
    if (part === '..') resolved.pop()
    else if (part !== '.') resolved.push(part)
  }
  return resolved.join('/')
}
