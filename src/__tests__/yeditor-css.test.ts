import fs from "node:fs"
import path from "node:path"
import * as sass from "sass"
import { expect, it } from "vitest"
import { findGlobalSelectors } from "../yeditor/css-guard"

const src = path.resolve(__dirname, "..")
const entry = path.join(src, "yeditor/yeditor.scss")
const css = () => sass.compile(entry).css

// Every stylesheet the editor ships: the entry plus the ones components import.
const sheetPaths = ["yeditor", "components", "styles"].flatMap((dir) =>
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
