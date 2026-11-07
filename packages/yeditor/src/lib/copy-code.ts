export async function copyCodeToClipboard(code: string): Promise<boolean> {
  if (!code) return false
  await navigator.clipboard.writeText(code)
  return true
}
