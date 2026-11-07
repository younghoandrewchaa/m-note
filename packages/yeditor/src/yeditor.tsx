"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"
import type { Editor } from "@tiptap/react"
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
import {
  Table,
  TableRow,
  TableCell,
  TableHeader,
} from "@tiptap/extension-table"
import { Markdown } from "@tiptap/markdown"

// --- Tiptap Extension ---
import { Search } from "./components/tiptap-extension/search-extension"

// --- UI Primitives ---
import { Button } from "./components/tiptap-ui-primitive/button"
import { Spacer } from "./components/tiptap-ui-primitive/spacer"
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "./components/tiptap-ui-primitive/toolbar"

// --- Tiptap Node ---
import { ImageUploadNode } from "./components/tiptap-node/image-upload-node/image-upload-node-extension"
import { HorizontalRule } from "./components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import { CodeBlock } from "./components/tiptap-node/code-block-node/code-block-node-extension"
import { Frontmatter } from "./components/tiptap-node/frontmatter-node/frontmatter-node-extension"
import "./components/tiptap-node/blockquote-node/blockquote-node.scss"
import "./components/tiptap-node/frontmatter-node/frontmatter-node.scss"
import "./components/tiptap-node/code-block-node/code-block-node.scss"
import "./components/tiptap-ui/inline-code-copy/inline-code-copy-button.scss"
import "./components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "./components/tiptap-node/list-node/list-node.scss"
import "./components/tiptap-node/image-node/image-node.scss"
import "./components/tiptap-node/heading-node/heading-node.scss"
import "./components/tiptap-node/paragraph-node/paragraph-node.scss"
import "./components/tiptap-node/table-node/table-node.scss"

// --- Tiptap UI ---
import { HeadingDropdownMenu } from "./components/tiptap-ui/heading-dropdown-menu"
import { ImageUploadButton } from "./components/tiptap-ui/image-upload-button"
import { CopyMarkdownButton } from "./components/tiptap-ui/copy-markdown-button"
import { SaveButton } from "./components/tiptap-ui/save-button"
import { InlineCodeCopyButton } from "./components/tiptap-ui/inline-code-copy"
import { ListDropdownMenu } from "./components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "./components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "./components/tiptap-ui/code-block-button"
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from "./components/tiptap-ui/color-highlight-popover"
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from "./components/tiptap-ui/link-popover"
import { MarkButton } from "./components/tiptap-ui/mark-button"
import { TextAlignButton } from "./components/tiptap-ui/text-align-button"
import { UndoRedoButton } from "./components/tiptap-ui/undo-redo-button"
import { SearchPanel } from "./components/tiptap-ui/search-panel"

// --- Icons ---
import { ArrowLeftIcon } from "./components/tiptap-icons/arrow-left-icon"
import { HighlighterIcon } from "./components/tiptap-icons/highlighter-icon"
import { LinkIcon } from "./components/tiptap-icons/link-icon"

// --- Hooks ---
import { useIsBreakpoint } from "./hooks/use-is-breakpoint"
import { useWindowSize } from "./hooks/use-window-size"
import { useCursorVisibility } from "./hooks/use-cursor-visibility"

// --- Lib ---
import { cn, MAX_FILE_SIZE } from "./lib/tiptap-utils"
import { defaultOpenLink, YEditorConfigContext } from "./yeditor-context"
import { setMarkdownWithFrontmatter } from "./set-markdown"
import { isEventForEditor } from "./lib/editor-event"

// --- Styles ---
import "./yeditor.scss"

export type ImageUploadHandler = (
  file: File,
  onProgress?: (event: { progress: number }) => void,
  abortSignal?: AbortSignal,
) => Promise<string>

export interface YEditorProps {
  /** Markdown loaded once when the editor is created. May start with frontmatter. */
  initialValue?: string
  /** Fires on every user edit. Read the text with `handle.getMarkdown()`. */
  onChange?: () => void
  /** Enables Cmd/Ctrl+S and the Save button. */
  onSave?: () => void | Promise<void>
  /** Whether the Save button is enabled. Defaults to true. */
  canSave?: boolean
  /** Uploads an image and resolves to its URL. Enables the image button. */
  onImageUpload?: ImageUploadHandler
  /** Called when an image upload fails. Defaults to console.error. */
  onImageUploadError?: (error: Error) => void
  /** Opens a link from the link popover. Defaults to a new browser tab. */
  onOpenLink?: (url: string) => void
  /** Extra toolbar content rendered after the built-in groups. */
  toolbarEnd?: ReactNode
  /** Extra class on the wrapper element. */
  className?: string
  /** Accessible label of the editable area. */
  ariaLabel?: string
  /** Called once the editor exists and initialValue is loaded; the ref handle is usable from here. */
  onReady?: (handle: YEditorHandle) => void
}

export interface YEditorHandle {
  editor: Editor | null
  getMarkdown(): string
  /** Replaces the content (frontmatter-aware). Does not fire onChange. */
  setMarkdown(markdown: string): void
}

const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile,
  onSave,
  canSave,
  hasImageUpload,
  toolbarEnd,
}: {
  onHighlighterClick: () => void
  onLinkClick: () => void
  isMobile: boolean
  onSave?: () => Promise<void>
  canSave: boolean
  hasImageUpload: boolean
  toolbarEnd?: ReactNode
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
        {!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
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

      {hasImageUpload && (
        <>
          <ToolbarSeparator />
          <ToolbarGroup>
            <ImageUploadButton text="Add" />
          </ToolbarGroup>
        </>
      )}

      <ToolbarSeparator />

      <ToolbarGroup>
        {onSave && <SaveButton onSave={onSave} canSave={canSave} />}
        <CopyMarkdownButton />
        {toolbarEnd}
      </ToolbarGroup>

      <Spacer />
    </>
  )
}

const MobileToolbarContent = ({
  type,
  onBack,
}: {
  type: "highlighter" | "link"
  onBack: () => void
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

    {type === "highlighter" ? <ColorHighlightPopoverContent /> : <LinkContent />}
  </>
)

export const YEditor = forwardRef<YEditorHandle, YEditorProps>(
  function YEditor(
    {
      initialValue,
      onChange,
      onSave,
      canSave = true,
      onImageUpload,
      onImageUploadError,
      onOpenLink,
      toolbarEnd,
      className,
      ariaLabel = "Main content area, start typing to enter text.",
      onReady,
    },
    ref,
  ) {
    const editorId = useId()
    const isMobile = useIsBreakpoint()
    const { height } = useWindowSize()
    const [mobileView, setMobileView] = useState<
      "main" | "highlighter" | "link"
    >("main")
    const toolbarRef = useRef<HTMLDivElement>(null)

    // Callbacks live in refs so new inline lambdas don't recreate the editor.
    const onChangeRef = useRef(onChange)
    const onSaveRef = useRef(onSave)
    const onImageUploadRef = useRef(onImageUpload)
    const onImageUploadErrorRef = useRef(onImageUploadError)
    const onReadyRef = useRef(onReady)
    onReadyRef.current = onReady
    onChangeRef.current = onChange
    onSaveRef.current = onSave
    onImageUploadRef.current = onImageUpload
    onImageUploadErrorRef.current = onImageUploadError

    const hasImageUpload = !!onImageUpload

    const editor = useEditor(
      {
        immediatelyRender: false,
        editorProps: {
          attributes: {
            autocomplete: "off",
            autocorrect: "off",
            autocapitalize: "off",
            "aria-label": ariaLabel,
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
          // Always registered so toggling onImageUpload never recreates the editor;
          // the button is what's hidden when there's no handler.
          ImageUploadNode.configure({
            accept: "image/*",
            maxSize: MAX_FILE_SIZE,
            limit: 3,
            upload: (file, onProgress, abortSignal) => {
              const upload = onImageUploadRef.current
              if (!upload) {
                return Promise.reject(new Error("Image upload is not configured."))
              }
              return upload(file, onProgress, abortSignal)
            },
            onError: (error) =>
              (onImageUploadErrorRef.current ?? console.error)(error),
          }),
          Markdown,
          Search,
        ],
        content: "",
      },
      [],
    )

    const handle = useMemo<YEditorHandle>(
      () => ({
        editor,
        getMarkdown: () => (editor ? editor.getMarkdown() : ""),
        setMarkdown: (markdown: string) => {
          if (editor) setMarkdownWithFrontmatter(editor, markdown)
        },
      }),
      [editor],
    )
    useImperativeHandle(ref, () => handle, [handle])

    // Load initialValue once per editor instance.
    const loadedEditorRef = useRef<Editor | null>(null)
    useEffect(() => {
      if (!editor || loadedEditorRef.current === editor) return
      loadedEditorRef.current = editor
      // initialValue is only read when the editor is created.
      if (initialValue) setMarkdownWithFrontmatter(editor, initialValue)
      onReadyRef.current?.(handle)
    }, [editor, handle])

    useEffect(() => {
      if (!editor) return
      const handleUpdate = () => onChangeRef.current?.()
      editor.on("update", handleUpdate)
      return () => {
        editor.off("update", handleUpdate)
      }
    }, [editor])

    const handleSave = useCallback(async () => {
      await onSaveRef.current?.()
    }, [])

    useHotkeys(
      "mod+s",
      (e) => {
        if (!isEventForEditor(editor, e)) return
        e.preventDefault()
        void handleSave()
      },
      {
        enabled: !!onSave,
        enableOnFormTags: true,
        enableOnContentEditable: true,
      },
      [handleSave, editor],
    )

    const rect = useCursorVisibility({
      editor,
      overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
    })

    useEffect(() => {
      if (!isMobile && mobileView !== "main") {
        setMobileView("main")
      }
    }, [isMobile, mobileView])

    const config = useMemo(
      () => ({ onOpenLink: onOpenLink ?? defaultOpenLink, editorId }),
      [onOpenLink, editorId],
    )

    return (
      <div className={cn("simple-editor-wrapper", "yeditor", className)} data-yeditor-id={editorId}>
        <YEditorConfigContext.Provider value={config}>
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
                  onSave={onSave ? handleSave : undefined}
                  canSave={canSave}
                  hasImageUpload={hasImageUpload}
                  toolbarEnd={toolbarEnd}
                />
              ) : (
                <MobileToolbarContent
                  type={mobileView === "highlighter" ? "highlighter" : "link"}
                  onBack={() => setMobileView("main")}
                />
              )}
            </Toolbar>

            <SearchPanel editor={editor} />

            <EditorContent
              editor={editor}
              role="presentation"
              className="simple-editor-content"
            />

            <InlineCodeCopyButton editor={editor} />
          </EditorContext.Provider>
        </YEditorConfigContext.Provider>
      </div>
    )
  },
)
