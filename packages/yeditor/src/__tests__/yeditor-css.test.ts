import fs from "node:fs"
import path from "node:path"
import postcss from "postcss"
import * as sass from "sass"
import { expect, it } from "vitest"
import { findGlobalSelectors } from "../../scripts/css-guard.mjs"

const src = path.resolve(__dirname, "..")
const entry = path.join(src, "yeditor.scss")
const css = () => sass.compile(entry).css

// Every stylesheet the editor ships: the entry plus the ones components import.
const sheetPaths = ["components", "styles"].flatMap((dir) =>
  fs
    .readdirSync(path.join(src, dir), { recursive: true, encoding: "utf8" })
    .filter((rel) => rel.endsWith(".scss") && !path.basename(rel).startsWith("_"))
    .map((rel) => path.join(src, dir, rel)),
)

it("has no global element selectors", () => {
  expect(findGlobalSelectors(css())).toEqual([])
})

it.each(sheetPaths.map((p) => [path.relative(src, p), p]))(
  "%s has no global element selectors",
  (_name, file) => {
    expect(findGlobalSelectors(sass.compile(file).css)).toEqual([])
  },
)

it("does not import remote fonts", () => {
  expect(css()).not.toContain("fonts.googleapis.com")
})

it("keeps theme variables on :root and .dark", () => {
  const out = css()
  expect(out).toMatch(/:root\s*\{[^}]*--tt-bg-color/)
  expect(out).toMatch(/\.dark\s*\{[^}]*--tt-bg-color/)
})

it("guard flags global selectors", () => {
  expect(
    findGlobalSelectors("body{}html,.a{}* {}::-webkit-scrollbar{}.yeditor ::-webkit-scrollbar{}.body{}"),
  ).toEqual(["body", "html", "*", "::-webkit-scrollbar"])
})

// Tooltips, popovers and dropdowns portal into document.body, outside .yeditor.
it("declares font variables on :root so portalled UI can use them", () => {
  expect(css()).toMatch(/:root\s*\{[^}]*--tt-font-body/)
})

it.each([".tiptap-tooltip", ".tiptap-popover", ".tiptap-dropdown-menu-content"])(
  "%s uses the editor font, not the host page's",
  (selector) => {
    const fonts: string[] = []
    postcss.parse(css()).walkRules((rule) => {
      if (!rule.selectors.includes(selector)) return
      rule.walkDecls("font-family", (decl) => {
        fonts.push(decl.value)
      })
    })
    expect(fonts).toContain("var(--tt-font-body)")
  },
)
