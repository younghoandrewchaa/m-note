interface FileDropAPI {
  getFilePath: (file: File) => string
  readFile: (filePath: string) => Promise<{ path: string; content: string }>
  setFilePath?: (filePath: string) => void | Promise<void>
  checkForUpdate?: () => Promise<unknown>
}

interface FileDropCallbacks {
  setContent: (markdown: string) => void
  setFilePath: (path: string) => void
  setTitle: (name: string) => void
  onUpdateChecked?: (info: unknown) => void
}

export function handleFileDrop(
  files: FileList,
  electronAPI: FileDropAPI | undefined,
  callbacks: FileDropCallbacks,
): void {
  const file = Array.from(files).find((f) =>
    /\.(md|markdown)$/i.test(f.name),
  )
  if (!file) return

  const filePath = electronAPI?.getFilePath(file)

  if (filePath && electronAPI) {
    electronAPI.readFile(filePath).then(({ content }) => {
      callbacks.setContent(content)
      callbacks.setFilePath(filePath)
      callbacks.setTitle(file.name)
      electronAPI.setFilePath?.(filePath)
      electronAPI.checkForUpdate?.().then((info) => callbacks.onUpdateChecked?.(info))
    })
  } else {
    const reader = new FileReader()
    reader.onload = () => {
      callbacks.setContent(reader.result as string)
      callbacks.setTitle(file.name)
    }
    reader.readAsText(file)
  }
}
