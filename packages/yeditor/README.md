# YEditor

A React markdown editor built on [Tiptap](https://tiptap.dev), extracted from the M Note desktop app. Markdown goes in, markdown comes out. It includes a toolbar, frontmatter, tables, task lists, code blocks with syntax highlighting, Mermaid previews and in-document search.

## Install

```bash
npm install @younghoandrewchaa/yeditor
```

React 19 is a peer dependency.

## Usage

```tsx
import { useRef } from "react"
import { YEditor, type YEditorHandle } from "@younghoandrewchaa/yeditor"
import "@younghoandrewchaa/yeditor/style.css"

export function PostEditor({ post }: { post: string }) {
  const editor = useRef<YEditorHandle>(null)

  return (
    <div style={{ height: "80vh" }}>
      <YEditor
        ref={editor}
        initialValue={post}
        onSave={() => savePost(editor.current!.getMarkdown())}
        onImageUpload={(file) => uploadToCdn(file)} // resolves to the image URL
        toolbarEnd={<button onClick={publish}>Publish</button>}
      />
    </div>
  )
}
```

The editor fills its parent (`height: 100%`) and scrolls internally, with a sticky toolbar. Give the parent a height.

## Props

| Prop | Type | Notes |
| --- | --- | --- |
| `initialValue` | `string` | Markdown loaded once when the editor is created. A leading `---` block becomes an editable frontmatter block. |
| `onChange` | `() => void` | Fires on every user edit. Read the text with `ref.getMarkdown()` (debounce it for autosave). |
| `onSave` | `() => void \| Promise<void>` | Enables Cmd/Ctrl+S and the Save button. Without it, Cmd+S is left to the browser. |
| `canSave` | `boolean` | Whether the Save button is enabled. Defaults to `true`. |
| `onImageUpload` | `(file, onProgress?, signal?) => Promise<string>` | Uploads an image and resolves to its URL. Enables the image button. Without it, there is no image button. |
| `onImageUploadError` | `(error: Error) => void` | Defaults to `console.error`. |
| `onOpenLink` | `(url: string) => void` | Called by the link popover's "open" button. Defaults to a new tab for safe URLs. |
| `toolbarEnd` | `ReactNode` | Extra toolbar content after the built-in buttons. |
| `onReady` | `(handle: YEditorHandle) => void` | Called once the editor exists and `initialValue` is loaded. |
| `className` | `string` | Added to the wrapper (`.yeditor`). |
| `ariaLabel` | `string` | Accessible label for the editable area. |

### Ref handle

```ts
interface YEditorHandle {
  editor: Editor | null           // the underlying Tiptap editor
  getMarkdown(): string
  setMarkdown(markdown: string): void // frontmatter-aware; does not fire onChange
}
```

## Theming

- **Dark mode:** add a `dark` class to an ancestor, normally `<html>` (the same convention Tailwind uses).
- **Variables:** colours and fonts are CSS custom properties prefixed `--tt-`, declared on `:root` and `.dark`. Override them to match your site. They live on `:root` because tooltips, popovers and dropdowns render into `document.body`, outside the editor.
- **No global styles:** the stylesheet never targets `html`, `body` or `*`.
- **Fonts:** the editor uses `Inter` when it's available and falls back to the system font. Load Inter yourself if you want it:

  ```html
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" />
  ```

## Next.js and SSR

The bundle starts with `"use client"`, so `<YEditor>` can be imported from any component. Callback props such as `onSave` are functions, so pass them from a Client Component. Server rendering is safe, and the editor itself appears after hydration.

## Development

From the repository root:

```bash
npm run dev -w @younghoandrewchaa/yeditor    # browser playground (example/)
npm test -w @younghoandrewchaa/yeditor       # tests
npm run build -w @younghoandrewchaa/yeditor  # dist/ + type declarations + output checks
```

Code under `src/` must not depend on Electron or the M Note app (enforced by `src/__tests__/boundary.test.ts`).
