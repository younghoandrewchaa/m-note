// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  restoreScrollTop,
  saveScrollPosition,
  takeScrollPosition,
} from "../scroll-restore"

beforeEach(() => sessionStorage.clear())
afterEach(() => vi.restoreAllMocks())

it("returns the saved position for the same file", () => {
  saveScrollPosition("/a.md", 420)
  expect(takeScrollPosition("/a.md")).toBe(420)
})

it("returns nothing for a different file", () => {
  saveScrollPosition("/a.md", 420)
  expect(takeScrollPosition("/b.md")).toBeUndefined()
})

it("clears the entry after taking it", () => {
  saveScrollPosition("/a.md", 420)
  takeScrollPosition("/a.md")
  expect(takeScrollPosition("/a.md")).toBeUndefined()
})

it("ignores corrupt stored data", () => {
  sessionStorage.setItem("m-note:scroll-position", "{not json")
  expect(takeScrollPosition("/a.md")).toBeUndefined()
})

it("swallows storage errors", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota")
  })
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("denied")
  })
  expect(() => saveScrollPosition("/a.md", 1)).not.toThrow()
  expect(takeScrollPosition("/a.md")).toBeUndefined()
})

describe("restoreScrollTop", () => {
  let resize: () => void
  let disconnect: ReturnType<typeof vi.fn>

  // jsdom has no layout: fake a scroller whose scrollTop is clamped to maxScroll.
  function clampedScroller(maxScroll: { value: number }) {
    const el = document.createElement("div")
    let top = 0
    Object.defineProperty(el, "scrollTop", {
      get: () => top,
      set: (v: number) => {
        top = Math.min(v, maxScroll.value)
      },
    })
    return el
  }

  beforeEach(() => {
    vi.useFakeTimers()
    disconnect = vi.fn()
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          resize = cb
        }
        observe = vi.fn()
        disconnect = disconnect
      },
    )
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("applies the position on the next frame", () => {
    const max = { value: 5000 }
    const scroller = clampedScroller(max)
    restoreScrollTop(scroller, document.createElement("div"), 2400)
    vi.advanceTimersToNextFrame()
    expect(scroller.scrollTop).toBe(2400)
  })

  it("re-applies the position when late content makes the page taller", () => {
    const max = { value: 900 }
    const scroller = clampedScroller(max)
    restoreScrollTop(scroller, document.createElement("div"), 2400)
    vi.advanceTimersToNextFrame()
    expect(scroller.scrollTop).toBe(900)
    max.value = 5000
    resize()
    expect(scroller.scrollTop).toBe(2400)
  })

  it("stops once the user scrolls", () => {
    const max = { value: 900 }
    const scroller = clampedScroller(max)
    restoreScrollTop(scroller, document.createElement("div"), 2400)
    vi.advanceTimersToNextFrame()
    scroller.dispatchEvent(new Event("wheel"))
    max.value = 5000
    resize()
    expect(scroller.scrollTop).toBe(900)
    expect(disconnect).toHaveBeenCalled()
  })

  it("stops after the settle time", () => {
    const max = { value: 900 }
    const scroller = clampedScroller(max)
    restoreScrollTop(scroller, document.createElement("div"), 2400)
    vi.advanceTimersToNextFrame()
    vi.advanceTimersByTime(3000)
    max.value = 5000
    resize()
    expect(scroller.scrollTop).toBe(900)
  })
})
