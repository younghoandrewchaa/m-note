// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { NoteEditor, openNoteLink } from "../note-editor"

type Listener<T> = (value: T) => void
let host: HTMLDivElement
let root: Root
let fileOpened: Listener<string>
let saveBeforeClose: Listener<{ requestId: string; savePath?: string }>
let api: Record<string, ReturnType<typeof vi.fn>>

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("__APP_VERSION__", "9.9.9")
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
  api = {
    onFileOpened: vi.fn((cb) => {
      fileOpened = cb
      return () => undefined
    }),
    onSaveBeforeClose: vi.fn((cb) => {
      saveBeforeClose = cb
      return () => undefined
    }),
    readFile: vi.fn(async (path: string) => ({ path, content: "# B" })),
    saveFile: vi.fn(async () => undefined),
    setFilePath: vi.fn(async () => undefined),
    notifySaveComplete: vi.fn(),
    getFilePath: vi.fn(),
    openExternal: vi.fn(async () => undefined),
    openLocalFile: vi.fn(async () => true),
    checkForUpdate: vi.fn(async () => ({ status: "idle", revision: 0 })),
    getUpdateState: vi.fn(async () => ({ status: "idle", revision: 0 })),
    onUpdateStateChanged: vi.fn(() => () => undefined),
    installUpdate: vi.fn(),
  }
  ;(window as unknown as { electronAPI: unknown }).electronAPI = api
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(<NoteEditor />))
  await vi.waitFor(() => expect(fileOpened).toBeTypeOf("function"))
  await vi.waitFor(() => expect(host.querySelector(".ProseMirror")).not.toBeNull())
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function openFile(path: string) {
  await act(async () => fileOpened(path))
  await vi.waitFor(() => expect(document.title).toBe(path.split("/").pop()))
}

function typeText(text: string) {
  const editable = host.querySelector(".ProseMirror") as HTMLElement & {
    editor?: { commands: { insertContent: (t: string) => void } }
  }
  act(() => {
    editable.editor!.commands.insertContent(text)
  })
}

function pressModS() {
  act(() => {
    host.querySelector(".ProseMirror")!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "s",
        code: "KeyS",
        metaKey: true,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
  })
}

it("loads a file when file-opened fires", async () => {
  await openFile("/a/b.md")
  expect(api.readFile).toHaveBeenCalledWith("/a/b.md")
  expect(host.querySelector(".ProseMirror")!.textContent).toContain("B")
})

it("marks title dirty on edit", async () => {
  await openFile("/a/b.md")
  typeText("x")
  expect(document.title).toBe("● b.md")
})

it("Cmd+S saves markdown to the current path", async () => {
  await openFile("/a/b.md")
  typeText("edited")
  pressModS()
  await vi.waitFor(() => expect(api.saveFile).toHaveBeenCalled())
  const [path, markdown] = api.saveFile.mock.calls[0]
  expect(path).toBe("/a/b.md")
  expect(markdown).toContain("edited")
  await vi.waitFor(() => expect(document.title).toBe("b.md"))
})

it("save-before-close writes to savePath and replies success", async () => {
  await openFile("/a/b.md")
  await act(async () => saveBeforeClose({ requestId: "r1", savePath: "/x.md" }))
  await vi.waitFor(() =>
    expect(api.notifySaveComplete).toHaveBeenCalledWith({
      requestId: "r1",
      success: true,
    }),
  )
  expect(api.saveFile).toHaveBeenCalledWith("/x.md", expect.any(String))
  expect(api.setFilePath).toHaveBeenCalledWith("/x.md")
})

it("renders the app version and desktop-only buttons", () => {
  expect(host.textContent).toContain("v9.9.9")
  expect(host.querySelector('[aria-label="Save"]')).not.toBeNull()
  expect(host.querySelector('[aria-label="Add image"]')).toBeNull()
})

it("opens local markdown links via openLocalFile and others via openExternal", () => {
  openNoteLink("./c.md", "/a/b.md")
  expect(api.openLocalFile).toHaveBeenCalledWith("/a/c.md")
  openNoteLink("https://x.y", "/a/b.md")
  expect(api.openExternal).toHaveBeenCalledWith("https://x.y/")
  api.openExternal.mockClear()
  openNoteLink("javascript:alert(1)", "/a/b.md")
  expect(api.openExternal).not.toHaveBeenCalled()
})
