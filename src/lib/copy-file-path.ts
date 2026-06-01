export async function copyFilePathToClipboard(filePath: string | null): Promise<boolean> {
  if (!filePath) return false
  await navigator.clipboard.writeText(filePath)
  return true
}
