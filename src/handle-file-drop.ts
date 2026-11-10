interface FileDropAPI {
  getFilePath: (file: File) => string
  openLocalFile: (filePath: string) => Promise<boolean>
}

/** Opens each dropped markdown file as its own tab (or reuses an unedited Untitled one). */
export async function handleFileDrop(
  files: FileList,
  electronAPI: FileDropAPI | undefined,
): Promise<void> {
  if (!electronAPI) return
  for (const file of Array.from(files)) {
    if (!/\.(md|markdown)$/i.test(file.name)) continue
    const filePath = electronAPI.getFilePath(file)
    if (filePath) await electronAPI.openLocalFile(filePath)
  }
}
