import fs from 'node:fs'
import path from 'node:path'

const sessionPath = (userDataPath: string) => path.join(userDataPath, 'update-session.json')

export function saveUpdateSession(userDataPath: string, filePaths: string[]): void {
  fs.mkdirSync(userDataPath, { recursive: true })
  fs.writeFileSync(sessionPath(userDataPath), JSON.stringify(filePaths), 'utf-8')
}

export function clearUpdateSession(userDataPath: string): void {
  try {
    fs.unlinkSync(sessionPath(userDataPath))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

// Consume the snapshot so ordinary launches do not restore old documents.
export function takeUpdateSession(userDataPath: string): string[] {
  try {
    const content = fs.readFileSync(sessionPath(userDataPath), 'utf-8')
    clearUpdateSession(userDataPath)
    const files: unknown = JSON.parse(content)
    if (!Array.isArray(files)) return []
    return files.filter((file): file is string => {
      if (typeof file !== 'string' || !/\.(md|markdown)$/i.test(file)) return false
      try {
        return fs.statSync(file).isFile()
      } catch {
        return false
      }
    })
  } catch {
    return []
  }
}
