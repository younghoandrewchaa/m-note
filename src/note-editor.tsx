import { useCallback, useEffect, useRef, useState } from "react"

import {
  isEditorUpdateFrozen,
  runEditorTask,
  setEditorUpdateFrozen,
} from "@/editor-update-guard"
import { useAppUpdate } from "@/hooks/use-app-update"
import { UpdateBanner } from "@/components/update-banner"
import { CopyFilePathButton } from "@/components/tiptap-ui/copy-file-path-button"
import { CheckUpdateButton } from "@/components/tiptap-ui/check-update-button"
import { ThemeToggle } from "@/components/tiptap-templates/simple/theme-toggle"
import { handleFileDrop } from "@/handle-file-drop"
import {
  isLocalMarkdownLink,
  resolveLocalMarkdownPath,
} from "@/lib/local-markdown-link"
import { sanitizeUrl } from "@/lib/tiptap-utils"
import { YEditor, type YEditorHandle } from "@/yeditor"

const fileName = (path: string) => path.split("/").pop() ?? path

/** Opens a link from the editor: local .md files in M Note, everything else in the browser. */
export function openNoteLink(url: string, currentFilePath: string | null): void {
  if (isLocalMarkdownLink(url)) {
    void window.electronAPI?.openLocalFile(
      resolveLocalMarkdownPath(url, currentFilePath),
    )
    return
  }
  const safeUrl = sanitizeUrl(url, window.location.href)
  if (safeUrl !== "#") void window.electronAPI?.openExternal(safeUrl)
}

export function NoteEditor() {
  const editorRef = useRef<YEditorHandle>(null)
  const appUpdate = useAppUpdate()
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const currentFilePathRef = useRef<string | null>(null)
  const isDirtyRef = useRef(false)
  const [handle, setHandle] = useState<YEditorHandle | null>(null)

  const markClean = useCallback((path: string) => {
    currentFilePathRef.current = path
    setCurrentFilePath(path)
    isDirtyRef.current = false
    setIsDirty(false)
    document.title = fileName(path)
  }, [])

  const handleChange = useCallback(() => {
    if (isDirtyRef.current) return
    isDirtyRef.current = true
    setIsDirty(true)
    if (currentFilePathRef.current) {
      document.title = `● ${fileName(currentFilePathRef.current)}`
    }
  }, [])

  const handleSave = useCallback(async () => {
    const handle = editorRef.current
    const editor = handle?.editor
    const path = currentFilePathRef.current
    if (!handle || !editor || !path || !window.electronAPI) return
    if (isEditorUpdateFrozen(editor)) return
    await runEditorTask(editor, async () => {
      const markdown = handle.getMarkdown()
      await window.electronAPI.saveFile(path, markdown)
      if (handle.getMarkdown() !== markdown) return
      markClean(path)
    })
  }, [markClean])

  const handleOpenLink = useCallback(
    (url: string) => openNoteLink(url, currentFilePathRef.current),
    [],
  )

  // Globals used by the main process during updates and window close.
  useEffect(() => {
    const editor = handle?.editor
    if (!editor) return
    window.__hasUnsavedChanges = () => isDirtyRef.current
    window.__currentFilePath = () => currentFilePathRef.current
    window.__setUpdateFrozen = (frozen: boolean) => {
      setEditorUpdateFrozen(editor, frozen)
      document.body.inert = frozen
    }
    return () => {
      delete window.__hasUnsavedChanges
      delete window.__currentFilePath
      delete window.__setUpdateFrozen
      document.body.inert = false
    }
  }, [handle])

  useEffect(() => {
    if (!handle || !window.electronAPI) return
    return window.electronAPI.onSaveBeforeClose(
      async ({ requestId, savePath }) => {
        try {
          const destination = savePath ?? currentFilePathRef.current
          if (!destination) throw new Error("Choose a file before saving.")
          await window.electronAPI.saveFile(destination, handle.getMarkdown())
          await window.electronAPI.setFilePath(destination)
          markClean(destination)
          window.electronAPI.notifySaveComplete({ requestId, success: true })
        } catch (error) {
          window.electronAPI.notifySaveComplete({
            requestId,
            success: false,
            error:
              error instanceof Error ? error.message : "Unable to save note.",
          })
        }
      },
    )
  }, [handle, markClean])

  useEffect(() => {
    const editor = handle?.editor
    if (!handle || !editor || !window.electronAPI) return
    return window.electronAPI.onFileOpened(async (filePath) => {
      await runEditorTask(editor, async () => {
        const { content } = await window.electronAPI.readFile(filePath)
        handle.setMarkdown(content)
        markClean(filePath)
      })
    })
  }, [handle, markClean])

  useEffect(() => {
    const editor = handle?.editor
    if (!handle || !editor) return

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      if (isEditorUpdateFrozen(editor)) return
      const files = e.dataTransfer?.files
      if (!files?.length) return

      void runEditorTask(editor, () =>
        handleFileDrop(files, window.electronAPI, {
          setContent: (markdown) => handle.setMarkdown(markdown),
          setFilePath: (path) => {
            setCurrentFilePath(path)
            currentFilePathRef.current = path
            setIsDirty(false)
            isDirtyRef.current = false
          },
          setTitle: (name) => {
            document.title = name
          },
        }),
      ).catch((error) => {
        console.error("Unable to open dropped file:", error)
      })
    }

    document.addEventListener("dragover", handleDragOver)
    document.addEventListener("drop", handleDrop)
    return () => {
      document.removeEventListener("dragover", handleDragOver)
      document.removeEventListener("drop", handleDrop)
    }
  }, [handle])

  return (
    <>
      <UpdateBanner {...appUpdate} />
      <YEditor
        ref={editorRef}
        onReady={setHandle}
        onChange={handleChange}
        onSave={handleSave}
        canSave={isDirty && currentFilePath !== null}
        onOpenLink={handleOpenLink}
        toolbarEnd={
          <>
            <CopyFilePathButton filePath={currentFilePath} />
            <CheckUpdateButton
              onCheckForUpdate={appUpdate.check}
              updateStatus={appUpdate.state.status}
            />
            <ThemeToggle />
          </>
        }
      />
      <span className="version-label">v{__APP_VERSION__}</span>
    </>
  )
}
