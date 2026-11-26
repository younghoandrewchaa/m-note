// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { saveScrollPosition, takeScrollPosition } from "../scroll-restore"

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
