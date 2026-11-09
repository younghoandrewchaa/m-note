export async function copyHtmlToClipboard(html: string): Promise<boolean> {
  if (!html) return false
  await navigator.clipboard.writeText(html)
  return true
}
