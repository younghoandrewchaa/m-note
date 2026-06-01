"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"
import { useHotkeys } from "react-hotkeys-hook"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { Image } from "@tiptap/extension-image"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { Selection } from "@tiptap/extensions"
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table"
import { Markdown } from "@tiptap/markdown"

// --- UI Primitives ---
import { Button } from "@/components/tiptap-ui-primitive/button"
import { Spacer } from "@/components/tiptap-ui-primitive/spacer"
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar"

// --- Tiptap Node ---
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension"
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import { CodeBlock } from "@/components/tiptap-node/code-block-node/code-block-node-extension"
import { Frontmatter } from "@/components/tiptap-node/frontmatter-node/frontmatter-node-extension"
import { extractFrontmatter } from "@/lib/frontmatter"
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/frontmatter-node/frontmatter-node.scss"
import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/image-node/image-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"
import "@/components/tiptap-node/table-node/table-node.scss"

// --- Tiptap UI ---
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu"
import { ImageUploadButton } from "@/components/tiptap-ui/image-upload-button"
import { CopyMarkdownButton } from "@/components/tiptap-ui/copy-markdown-button"
import { CopyFilePathButton } from "@/components/tiptap-ui/copy-file-path-button"
import { SaveButton } from "@/components/tiptap-ui/save-button"
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button"
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from "@/components/tiptap-ui/color-highlight-popover"
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from "@/components/tiptap-ui/link-popover"
import { MarkButton } from "@/components/tiptap-ui/mark-button"
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button"
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button"

// --- Icons ---
import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon"
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"

// --- Hooks ---
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint"
import { useWindowSize } from "@/hooks/use-window-size"
import { useCursorVisibility } from "@/hooks/use-cursor-visibility"

// --- Components ---
import { ThemeToggle } from "@/components/tiptap-templates/simple/theme-toggle"

// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils"
import { handleFileDrop } from "@/handle-file-drop"

// --- Styles ---
import "@/components/tiptap-templates/simple/simple-editor.scss"


const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile,
  onSave,
  canSave,
  currentFilePath,
}: {
  onHighlighterClick: () => void
  onLinkClick: () => void
  isMobile: boolean
  onSave: () => Promise<void>
  canSave: boolean
  currentFilePath: string | null
}) => {
  return (
    <>
      <Spacer />

      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HeadingDropdownMenu modal={false} levels={[1, 2, 3, 4]} />
        <ListDropdownMenu
          modal={false}
          types={["bulletList", "orderedList", "taskList"]}
        />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="code" />
        <MarkButton type="underline" />
        {!isMobile ? (
          <ColorHighlightPopover />
        ) : (
          <ColorHighlightPopoverButton onClick={onHighlighterClick} />
        )}
        {!isMobile ? <LinkPopover currentFilePath={currentFilePath} /> : <LinkButton onClick={onLinkClick} />}
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="superscript" />
        <MarkButton type="subscript" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <TextAlignButton align="left" />
        <TextAlignButton align="center" />
        <TextAlignButton align="right" />
        <TextAlignButton align="justify" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ImageUploadButton text="Add" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <SaveButton onSave={onSave} canSave={canSave} />
        <CopyMarkdownButton />
        <CopyFilePathButton filePath={currentFilePath} />
      </ToolbarGroup>

      <Spacer />

      {isMobile && <ToolbarSeparator />}

      <ToolbarGroup>
        <ThemeToggle />
      </ToolbarGroup>
    </>
  )
}

const MobileToolbarContent = ({
  type,
  onBack,
  currentFilePath,
}: {
  type: "highlighter" | "link"
  onBack: () => void
  currentFilePath: string | null
}) => (
  <>
    <ToolbarGroup>
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === "highlighter" ? (
          <HighlighterIcon className="tiptap-button-icon" />
        ) : (
          <LinkIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    {type === "highlighter" ? (
      <ColorHighlightPopoverContent />
    ) : (
      <LinkContent currentFilePath={currentFilePath} />
    )}
  </>
)

export function SimpleEditor() {
  const isMobile = useIsBreakpoint()
  const { height } = useWindowSize()
  const [mobileView, setMobileView] = useState<"main" | "highlighter" | "link">(
    "main"
  )
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [updateInfo, setUpdateInfo] = useState<{ version: string; downloadUrl: string } | null>(null)
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const currentFilePathRef = useRef<string | null>(null)
  const isDirtyRef = useRef(false)

  const editor = useEditor({
    immediatelyRender: false,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "Main content area, start typing to enter text.",
        class: "simple-editor",
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        codeBlock: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      CodeBlock,
      Frontmatter,
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Image,
      Typography,
      Superscript,
      Subscript,
      Selection,
      Table,
      TableRow,
      TableCell,
      TableHeader,
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error) => console.error("Upload failed:", error),
      }),
      Markdown,
    ],
    content: "",
  })

  const rect = useCursorVisibility({
    editor,
    overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
  })

  const handleSave = useCallback(async () => {
    if (!editor || !currentFilePathRef.current || !window.electronAPI) return
    const markdown = (editor as any).getMarkdown() as string
    await window.electronAPI.saveFile(currentFilePathRef.current, markdown)
    setIsDirty(false)
    isDirtyRef.current = false
    const fileName = currentFilePathRef.current.split('/').pop() ?? currentFilePathRef.current
    document.title = fileName
  }, [editor])

  useHotkeys('mod+s', (e) => {
    e.preventDefault()
    handleSave()
  }, { enableOnFormTags: true, enableOnContentEditable: true }, [handleSave])

  useEffect(() => {
    if (!editor) return
    const onUpdate = () => {
      if (!isDirtyRef.current) {
        setIsDirty(true)
        isDirtyRef.current = true
        if (currentFilePathRef.current) {
          const fileName = currentFilePathRef.current.split('/').pop() ?? currentFilePathRef.current
          document.title = `● ${fileName}`
        }
      }
    }
    editor.on('update', onUpdate)
    return () => { editor.off('update', onUpdate) }
  }, [editor])

  useEffect(() => {
    (window as any).__hasUnsavedChanges = () => isDirtyRef.current
    return () => { delete (window as any).__hasUnsavedChanges }
  }, [])

  useEffect(() => {
    if (!window.electronAPI) return
    const unsubscribe = window.electronAPI.onSaveBeforeClose(async () => {
      if (editor && currentFilePathRef.current) {
        const markdown = (editor as any).getMarkdown() as string
        await window.electronAPI.saveFile(currentFilePathRef.current, markdown)
      }
      window.electronAPI.notifySaveComplete()
    })
    return unsubscribe
  }, [editor])

  useEffect(() => {
    if (!isMobile && mobileView !== "main") {
      setMobileView("main")
    }
  }, [isMobile, mobileView])

  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.checkForUpdate().then((info) => {
      if (info) setUpdateInfo(info)
    })
  }, [])

  useEffect(() => {
    if (!editor || !window.electronAPI) return
    const unsubscribe = window.electronAPI.onFileOpened(async (filePath) => {
      const { content: markdownContent } = await window.electronAPI.readFile(filePath)
      const { frontmatter, body } = extractFrontmatter(markdownContent)
      editor.commands.setContent(body, { emitUpdate: false, contentType: 'markdown' })
      if (frontmatter !== null) {
        editor.commands.insertContentAt(0, {
          type: 'frontmatter',
          content: frontmatter ? [{ type: 'text', text: frontmatter }] : [],
        })
      }
      setCurrentFilePath(filePath)
      currentFilePathRef.current = filePath
      setIsDirty(false)
      isDirtyRef.current = false
      document.title = filePath.split('/').pop() ?? filePath
      window.electronAPI.checkForUpdate().then((info) => {
        if (info) setUpdateInfo(info)
      })
    })
    return unsubscribe
  }, [editor])

  useEffect(() => {
    if (!editor) return

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      const files = e.dataTransfer?.files
      if (!files?.length) return

      handleFileDrop(files, window.electronAPI, {
        setContent: (markdown) => {
          const { frontmatter, body } = extractFrontmatter(markdown)
          editor.commands.setContent(body, { emitUpdate: false, contentType: 'markdown' })
          if (frontmatter !== null) {
            editor.commands.insertContentAt(0, {
              type: 'frontmatter',
              content: frontmatter ? [{ type: 'text', text: frontmatter }] : [],
            })
          }
        },
        setFilePath: (path) => {
          setCurrentFilePath(path)
          currentFilePathRef.current = path
          setIsDirty(false)
          isDirtyRef.current = false
        },
        setTitle: (name) => {
          document.title = name
        },
      })
    }

    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)
    return () => {
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
    }
  }, [editor])

  return (
    <div className="simple-editor-wrapper">
      {updateInfo && (
        <div className="update-banner">
          <span>M Note v{updateInfo.version} is available.</span>
          <button
            className="update-banner-link"
            onClick={() => window.electronAPI?.openExternal(updateInfo.downloadUrl)}
          >
            Download
          </button>
          <button
            className="update-banner-dismiss"
            onClick={() => setUpdateInfo(null)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      <EditorContext.Provider value={{ editor }}>
        <Toolbar
          ref={toolbarRef}
          style={{
            ...(isMobile
              ? {
                  bottom: `calc(100% - ${height - rect.y}px)`,
                }
              : {}),
          }}
        >
          {mobileView === "main" ? (
            <MainToolbarContent
              onHighlighterClick={() => setMobileView("highlighter")}
              onLinkClick={() => setMobileView("link")}
              isMobile={isMobile}
              onSave={handleSave}
              canSave={isDirty && currentFilePath !== null}
              currentFilePath={currentFilePath}
            />
          ) : (
            <MobileToolbarContent
              type={mobileView === "highlighter" ? "highlighter" : "link"}
              onBack={() => setMobileView("main")}
              currentFilePath={currentFilePath}
            />
          )}
        </Toolbar>

        <EditorContent
          editor={editor}
          role="presentation"
          className="simple-editor-content"
        />
      </EditorContext.Provider>
    </div>
  )
}
