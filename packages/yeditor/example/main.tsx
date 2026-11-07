// A blog-like page that hosts YEditor in a plain browser, with no Electron.
import { StrictMode, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { YEditor, type YEditorHandle } from "../src"
import "./playground.css"

const samplePost = `---
title: Hello from YEditor
date: 2026-11-07
tags: [blog, markdown]
---

# Hello from YEditor

This page hosts the editor the way a **React blog** would.

- Try the toolbar, links and highlights
- Press Cmd/Ctrl+S to "save" (logs to the console)
- Add an image (stays local as a blob URL)

\`\`\`ts
const answer: number = 42
\`\`\`
`

function Playground() {
  const editorRef = useRef<YEditorHandle>(null)
  const [markdown, setMarkdown] = useState(samplePost)
  const [dark, setDark] = useState(false)

  const toggleDark = (next: boolean) => {
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
  }

  return (
    <div className="page">
      <header className="page-header">
        <strong>My Blog · New post</strong>
        <label>
          <input
            type="checkbox"
            checked={dark}
            onChange={(e) => toggleDark(e.target.checked)}
          />{" "}
          Dark mode
        </label>
      </header>
      <main className="page-main">
        <section className="editor-pane">
          <YEditor
            ref={editorRef}
            initialValue={samplePost}
            onChange={() => setMarkdown(editorRef.current?.getMarkdown() ?? "")}
            onSave={() => console.log("[playground] save", editorRef.current?.getMarkdown())}
            onImageUpload={(file) => Promise.resolve(URL.createObjectURL(file))}
            toolbarEnd={
              <button className="publish" onClick={() => console.log("[playground] publish", editorRef.current?.getMarkdown())}>
                Publish
              </button>
            }
          />
        </section>
        <aside className="preview-pane">
          <h2>Markdown</h2>
          <pre>{markdown}</pre>
        </aside>
      </main>
    </div>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Playground />
  </StrictMode>,
)
