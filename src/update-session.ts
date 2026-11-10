import fs from 'node:fs'
import path from 'node:path'

export interface UpdateSession { files: string[]; activeFile: string | null }

const sessionPath = (userDataPath: string) => path.join(userDataPath, 'update-session.json')

export function saveUpdateSession(userDataPath: string, session: UpdateSession): void {
  fs.mkdirSync(userDataPath, { recursive: true })
  fs.writeFileSync(sessionPath(userDataPath), JSON.stringify(session), 'utf-8')
}

export function clearUpdateSession(userDataPath: string): void {
  try {
    fs.unlinkSync(sessionPath(userDataPath))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

const isRestorableFile = (file: unknown): file is string => {
  if (typeof file !== 'string' || !/\.(md|markdown)$/i.test(file)) return false
  try {
    return fs.statSync(file).isFile()
  } catch {
    return false
  }
}

// Consume the snapshot so ordinary launches do not restore old documents.
// Also reads the legacy format, a plain array of file paths.
export function takeUpdateSession(userDataPath: string): UpdateSession {
  try {
    const content = fs.readFileSync(sessionPath(userDataPath), 'utf-8')
    clearUpdateSession(userDataPath)
    const parsed: unknown = JSON.parse(content)
    const record = parsed as { files?: unknown; activeFile?: unknown } | null
    const rawFiles = Array.isArray(parsed) ? parsed : record?.files
    if (!Array.isArray(rawFiles)) return { files: [], activeFile: null }
    const files = rawFiles.filter(isRestorableFile)
    const activeFile = !Array.isArray(parsed) && files.includes(record?.activeFile as string)
      ? (record?.activeFile as string)
      : null
    return { files, activeFile }
  } catch {
    return { files: [], activeFile: null }
  }
}
