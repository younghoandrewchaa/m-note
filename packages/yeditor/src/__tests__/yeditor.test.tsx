// @vitest-environment jsdom
import { act, createRef, type ReactNode, type RefObject } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { YEditor, type YEditorHandle, type YEditorProps } from "../index"
import { useLinkHandler } from "../components/tiptap-ui/link-popover"
import { YEditorConfigContext } from "../yeditor-context"

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function renderEditor(props: YEditorProps = {}) {
  const ref = createRef<YEditorHandle>()
  await act(async () => root.render(<YEditor ref={ref} {...props} />))
  await vi.waitFor(() => expect(ref.current?.editor).toBeTruthy())
  return ref as RefObject<YEditorHandle>
}

async function renderNode(node: ReactNode) {
  await act(async () => root.render(node))
}

it("loads initialValue and round-trips markdown", async () => {
  const ref = await renderEditor({ initialValue: "# Title\n\nHello **world**" })
  expect(ref.current.getMarkdown().trim()).toBe("# Title\n\nHello **world**")
})

it("round-trips frontmatter from initialValue", async () => {
  const ref = await renderEditor({
    initialValue: "---\ntitle: Post\n---\n\n# Hi",
  })
  expect(ref.current.editor!.state.doc.firstChild!.type.name).toBe(
    "frontmatter",
  )
  expect(ref.current.getMarkdown()).toMatch(/^---\ntitle: Post\n---/)
})

it("setMarkdown replaces content with frontmatter and does not fire onChange", async () => {
  const onChange = vi.fn()
  const ref = await renderEditor({ onChange })
  act(() => ref.current.setMarkdown("---\na: 1\n---\n\nBody"))
  expect(onChange).not.toHaveBeenCalled()
  expect(ref.current.editor!.state.doc.firstChild!.type.name).toBe(
    "frontmatter",
  )
  expect(ref.current.getMarkdown()).toContain("Body")
})

it("undo right after setMarkdown keeps the frontmatter", async () => {
  const ref = await renderEditor()
  act(() => ref.current.setMarkdown("---\na: 1\n---\n\nBody"))
  act(() => {
    ref.current.editor!.commands.undo()
  })
  expect(ref.current.editor!.state.doc.firstChild!.type.name).toBe(
    "frontmatter",
  )
})

it("fires onChange on user edits", async () => {
  const onChange = vi.fn()
  const ref = await renderEditor({ onChange })
  act(() => {
    ref.current.editor!.commands.insertContent("x")
  })
  expect(onChange).toHaveBeenCalledOnce()
})

function pressModS() {
  const target = host.querySelector(".ProseMirror")!
  const event = new KeyboardEvent("keydown", {
    key: "s",
    code: "KeyS",
    metaKey: true,
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  })
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}

it("mod+s calls onSave", async () => {
  const onSave = vi.fn()
  await renderEditor({ onSave })
  pressModS()
  expect(onSave).toHaveBeenCalledOnce()
})

it("does not intercept mod+s without onSave", async () => {
  await renderEditor()
  const event = pressModS()
  expect(event.defaultPrevented).toBe(false)
})

it("hides Save and image buttons when their callbacks are absent", async () => {
  await renderEditor()
  expect(host.querySelector('[aria-label="Save"]')).toBeNull()
  expect(host.querySelector('[aria-label="Add image"]')).toBeNull()
})

it("shows Save and image buttons when their callbacks are given", async () => {
  await renderEditor({
    onSave: vi.fn(),
    onImageUpload: vi.fn().mockResolvedValue("https://img/x.png"),
  })
  expect(host.querySelector('[aria-label="Save"]')).not.toBeNull()
  expect(host.querySelector('[aria-label="Add image"]')).not.toBeNull()
})

it("renders toolbarEnd content", async () => {
  await renderEditor({ toolbarEnd: <button>Publish</button> })
  expect(host.textContent).toContain("Publish")
})

it("adds className to the wrapper", async () => {
  await renderEditor({ className: "blog-editor" })
  expect(host.querySelector(".yeditor.blog-editor")).not.toBeNull()
})

function LinkOpener({ url }: { url: string }) {
  const { openLink, setUrl } = useLinkHandler({ editor: null })
  return (
    <button
      onClick={() => openLink()}
      ref={(el) => {
        if (el && el.dataset.url !== url) {
          el.dataset.url = url
          setUrl(url)
        }
      }}
    >
      open
    </button>
  )
}

it("passes onOpenLink through context", async () => {
  const onOpenLink = vi.fn()
  await renderNode(
    <YEditorConfigContext.Provider value={{ onOpenLink }}>
      <LinkOpener url="https://a.com" />
    </YEditorConfigContext.Provider>,
  )
  act(() => host.querySelector("button")!.click())
  expect(onOpenLink).toHaveBeenCalledWith("https://a.com")
})

it("opens safe links in a new tab by default and ignores unsafe ones", async () => {
  const open = vi.fn()
  vi.stubGlobal("open", open)
  await renderNode(<LinkOpener url="https://a.com" />)
  act(() => host.querySelector("button")!.click())
  expect(open).toHaveBeenCalledWith(
    "https://a.com/",
    "_blank",
    "noopener,noreferrer",
  )
  open.mockClear()
  await renderNode(<LinkOpener url="javascript:alert(1)" />)
  act(() => host.querySelector("button")!.click())
  expect(open).not.toHaveBeenCalled()
})

it("two instances are independent", async () => {
  const first = createRef<YEditorHandle>()
  const second = createRef<YEditorHandle>()
  await act(async () =>
    root.render(
      <>
        <YEditor ref={first} initialValue="One" />
        <YEditor ref={second} initialValue="Two" />
      </>,
    ),
  )
  await vi.waitFor(() => {
    expect(first.current?.editor).toBeTruthy()
    expect(second.current?.editor).toBeTruthy()
  })
  act(() => first.current!.setMarkdown("A"))
  expect(first.current!.getMarkdown().trim()).toBe("A")
  expect(second.current!.getMarkdown().trim()).toBe("Two")
})

it("calls onReady once with a usable handle after initialValue loads", async () => {
  const onReady = vi.fn()
  await renderEditor({ initialValue: "Ready text", onReady })
  await vi.waitFor(() => expect(onReady).toHaveBeenCalledOnce())
  expect(onReady.mock.calls[0][0].getMarkdown().trim()).toBe("Ready text")
})

async function renderTwo(a: YEditorProps, b: YEditorProps) {
  const first = createRef<YEditorHandle>()
  const second = createRef<YEditorHandle>()
  await act(async () =>
    root.render(
      <>
        <YEditor ref={first} {...a} />
        <YEditor ref={second} {...b} />
      </>,
    ),
  )
  await vi.waitFor(() => {
    expect(first.current?.editor).toBeTruthy()
    expect(second.current?.editor).toBeTruthy()
  })
  return host.querySelectorAll<HTMLElement>(".ProseMirror")
}

function press(target: EventTarget, key: string) {
  const event = new KeyboardEvent("keydown", {
    key,
    code: `Key${key.toUpperCase()}`,
    metaKey: true,
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  })
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}

it("mod+s only saves the editor the key was pressed in", async () => {
  const saveA = vi.fn()
  const saveB = vi.fn()
  const [a] = await renderTwo({ onSave: saveA }, { onSave: saveB })
  press(a, "s")
  expect(saveA).toHaveBeenCalledOnce()
  expect(saveB).not.toHaveBeenCalled()
})

it("mod+s outside any editor is left to the browser when there are two editors", async () => {
  const saveA = vi.fn()
  const saveB = vi.fn()
  await renderTwo({ onSave: saveA }, { onSave: saveB })
  const event = press(document.body, "s")
  expect(saveA).not.toHaveBeenCalled()
  expect(saveB).not.toHaveBeenCalled()
  expect(event.defaultPrevented).toBe(false)
})

it("mod+s with nothing focused still saves a lone editor", async () => {
  const onSave = vi.fn()
  await renderEditor({ onSave })
  press(document.body, "s")
  expect(onSave).toHaveBeenCalledOnce()
})

it("mod+f only opens search in the editor the key was pressed in", async () => {
  const [a] = await renderTwo({}, {})
  press(a, "f")
  expect(host.querySelectorAll(".search-panel")).toHaveLength(1)
  expect(a.closest(".yeditor")!.querySelector(".search-panel")).not.toBeNull()
})

it("toggling onImageUpload keeps the editor, its edits and calls onReady once", async () => {
  const onReady = vi.fn()
  const ref = await renderEditor({ initialValue: "Start", onReady })
  const editor = ref.current.editor
  act(() => {
    ref.current.editor!.commands.insertContentAt(
      ref.current.editor!.state.doc.content.size,
      { type: "paragraph", content: [{ type: "text", text: "Typed" }] },
    )
  })
  await act(async () =>
    root.render(
      <YEditor
        ref={ref}
        initialValue="Start"
        onReady={onReady}
        onImageUpload={vi.fn().mockResolvedValue("u")}
      />,
    ),
  )
  expect(ref.current.editor).toBe(editor)
  expect(ref.current.getMarkdown()).toContain("Typed")
  expect(onReady).toHaveBeenCalledOnce()
  expect(host.querySelector('[aria-label="Add image"]')).not.toBeNull()
})
