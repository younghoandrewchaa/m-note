// @vitest-environment jsdom
import { act, createRef, type ReactNode, type RefObject } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { YEditor, type YEditorHandle, type YEditorProps } from "../index"
import { useLinkHandler } from "../components/tiptap-ui/link-popover"
import { YEditorConfigContext } from "../yeditor-context"
import { Popover, PopoverContent } from "../components/tiptap-ui-primitive/popover"
import { Blob as NodeBlob } from "node:buffer"

let host: HTMLDivElement
let root: Root
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard")

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
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  if (originalClipboard) {
    Object.defineProperty(navigator, "clipboard", originalClipboard)
  } else {
    Reflect.deleteProperty(navigator, "clipboard")
  }
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

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)
  const write = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText, write },
  })
  vi.stubGlobal("Blob", NodeBlob)
  // jsdom has no system clipboard or ClipboardItem implementation.
  vi.stubGlobal("ClipboardItem", class {
    constructor(public data: Record<string, NodeBlob>) {}
  })
  return { writeText, write }
}

async function openHtmlMenu() {
  const trigger = host.querySelector<HTMLButtonElement>('[aria-label="Copy as HTML"]')
  expect(trigger).not.toBeNull()
  if (!trigger) throw new Error("Copy as HTML toolbar button is missing")
  await act(async () => {
    trigger.dispatchEvent(new KeyboardEvent("keydown", {
      key: "ArrowDown", bubbles: true, cancelable: true,
    }))
  })
  return trigger
}

async function selectHtmlAction(label: string) {
  const item = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    .find((element) => element.textContent === label)
  expect(item).toBeDefined()
  if (!item) throw new Error(`Menu action is missing: ${label}`)
  await act(async () => item.click())
}

it("copies the entire note as escaped HTML source beside the Markdown action", async () => {
  const clipboard = mockClipboard()
  const ref = await renderEditor({ initialValue: '# Title\n\nHello **world**\n\n```html\n<b>literal</b>\n```\n\nEnd' })
  const editor = ref.current.editor
  if (!editor) throw new Error("Editor is missing")
  act(() => editor.commands.setTextSelection({ from: 1, to: 3 }))
  const trigger = await openHtmlMenu()
  expect(trigger.previousElementSibling?.getAttribute("aria-label")).toBe("Copy as Markdown")
  await selectHtmlAction("Copy HTML source")
  expect(clipboard.writeText).toHaveBeenCalledWith(
    '<h1>Title</h1><p>Hello <strong>world</strong></p><pre><code class="language-html">&lt;b&gt;literal&lt;/b&gt;</code></pre><p>End</p>',
  )
  expect(clipboard.write).not.toHaveBeenCalled()
  expect(document.querySelector('[role="menu"]')).toBeNull()
  expect(trigger.getAttribute("aria-label")).toBe("Copied as HTML")
})

it("copies formatted HTML with readable plain text as one clipboard item", async () => {
  const clipboard = mockClipboard()
  await renderEditor({ initialValue: '# Title\n\nHello **world**' })
  await openHtmlMenu()
  await selectHtmlAction("Copy formatted content")
  const items = clipboard.write.mock.calls[0][0]
  expect(items).toHaveLength(1)
  expect(await items[0].data["text/html"].text()).toBe('<h1>Title</h1><p>Hello <strong>world</strong></p>')
  expect(await items[0].data["text/plain"].text()).toBe('Title\n\nHello world')
  expect(clipboard.writeText).not.toHaveBeenCalled()
})

it.each(["Copy HTML source", "Copy formatted content"])("exports special content without editor UI through %s", async (label) => {
  const clipboard = mockClipboard()
  await renderEditor({ initialValue: '---\ntitle: Post\n---\n\n```mermaid\ngraph TD; A-->B\n```\n\n- [Link](https://example.com)\n\n| Name |\n| --- |\n| Alice |\n\n![Photo](images/photo.png)' })
  await openHtmlMenu()
  await selectHtmlAction(label)
  const html = label === "Copy HTML source"
    ? clipboard.writeText.mock.calls[0][0]
    : await clipboard.write.mock.calls[0][0][0].data["text/html"].text()
  const fragment = document.createElement("div")
  fragment.innerHTML = html
  expect(fragment.querySelector('pre[data-type="frontmatter"] code')?.textContent).toBe("title: Post")
  expect(fragment.querySelector('code.language-mermaid')?.textContent).toBe("graph TD; A-->B")
  expect(fragment.querySelector("ul li a")?.getAttribute("href")).toBe("https://example.com")
  expect(fragment.querySelector("table th")?.textContent).toBe("Name")
  expect(fragment.querySelector("table td")?.textContent).toBe("Alice")
  expect(fragment.querySelector("img")?.getAttribute("src")).toBe("images/photo.png")
  expect(fragment.querySelector("img")?.getAttribute("alt")).toBe("Photo")
  expect(fragment.querySelector("button, svg, style, html, body")).toBeNull()
})

it("copies an empty note as an HTML fragment", async () => {
  const clipboard = mockClipboard()
  await renderEditor()
  await openHtmlMenu()
  await selectHtmlAction("Copy HTML source")
  expect(clipboard.writeText).toHaveBeenCalledWith("<p></p>")
})

it.each(["Copy HTML source", "Copy formatted content"])("shows failure and permits retry for %s", async (label) => {
  const clipboard = mockClipboard()
  const write = label === "Copy HTML source" ? clipboard.writeText : clipboard.write
  write.mockRejectedValueOnce(new Error("Permission denied"))
  await renderEditor({ initialValue: "Hello" })
  const trigger = await openHtmlMenu()
  await selectHtmlAction(label)
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("Could not copy")
  expect(document.querySelector('[role="menu"]')).not.toBeNull()
  expect(trigger.getAttribute("aria-label")).toBe("Copy as HTML")
  await selectHtmlAction(label)
  expect(document.querySelector('[role="alert"]')).toBeNull()
  expect(trigger.getAttribute("aria-label")).toBe("Copied as HTML")
})

it("reports unavailable rich clipboard support without silently copying another format", async () => {
  const clipboard = mockClipboard()
  vi.stubGlobal("ClipboardItem", undefined)
  await renderEditor({ initialValue: "Hello" })
  const trigger = await openHtmlMenu()
  await selectHtmlAction("Copy formatted content")
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("Could not copy")
  expect(trigger.getAttribute("aria-label")).toBe("Copy as HTML")
  expect(clipboard.writeText).not.toHaveBeenCalled()
})

it("waits for clipboard success, prevents duplicate writes, and returns keyboard focus", async () => {
  const clipboard = mockClipboard()
  let finish!: () => void
  clipboard.writeText.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve }))
  await renderEditor({ initialValue: "Hello" })
  const trigger = await openHtmlMenu()
  await selectHtmlAction("Copy HTML source")
  expect(document.querySelector('[role="menu"]')).not.toBeNull()
  expect(trigger.getAttribute("aria-label")).toBe("Copy as HTML")
  expect(Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
    .every((item) => item.disabled)).toBe(true)
  await selectHtmlAction("Copy HTML source")
  expect(clipboard.writeText).toHaveBeenCalledTimes(1)
  await act(async () => finish())
  expect(document.querySelector('[role="menu"]')).toBeNull()
  expect(trigger.getAttribute("aria-label")).toBe("Copied as HTML")
  // Radix restores focus on the next task after unmounting its focus scope.
  await act(async () => vi.waitFor(() => expect(document.activeElement).toBe(trigger)))
})

it("clears the success check after two seconds", async () => {
  mockClipboard()
  await renderEditor({ initialValue: "Hello" })
  const trigger = await openHtmlMenu()
  vi.useFakeTimers()
  await selectHtmlAction("Copy HTML source")
  expect(trigger.getAttribute("aria-label")).toBe("Copied as HTML")
  await act(async () => vi.advanceTimersByTimeAsync(2000))
  expect(trigger.getAttribute("aria-label")).toBe("Copy as HTML")
})

it("keeps focus on an outside control when it dismisses the menu", async () => {
  await renderEditor({ initialValue: "Hello", toolbarEnd: <button>Other action</button> })
  await openHtmlMenu()
  const outside = Array.from(host.querySelectorAll("button"))
    .find((button) => button.textContent === "Other action")
  if (!outside) throw new Error("Outside control is missing")
  await act(async () => {
    outside.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }))
    outside.focus()
    outside.click()
  })
  expect(document.querySelector('[role="menu"]')).toBeNull()
  // Wait for the deferred close-focus handler before checking the destination.
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
  expect(document.activeElement === outside).toBe(true)
})

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

it("routes save and search shortcuts from a portalled input to its owning editor", async () => {
  const saveA = vi.fn()
  const saveB = vi.fn()
  const [a, b] = await renderTwo(
    {
      onSave: saveA,
      toolbarEnd: (
        <Popover defaultOpen>
          <PopoverContent><input aria-label="Portal input" /></PopoverContent>
        </Popover>
      ),
    },
    { onSave: saveB },
  )
  const input = document.querySelector('[aria-label="Portal input"]')!
  expect(a.closest(".yeditor")!.contains(input)).toBe(false)
  expect(press(input, "s").defaultPrevented).toBe(true)
  expect(saveA).toHaveBeenCalledOnce()
  expect(saveB).not.toHaveBeenCalled()
  press(input, "f")
  expect(a.closest(".yeditor")!.querySelector(".search-panel")).not.toBeNull()
  expect(b.closest(".yeditor")!.querySelector(".search-panel")).toBeNull()
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
