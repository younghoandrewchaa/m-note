import fs from "node:fs"
import path from "node:path"
import { expect, it } from "vitest"

const src = path.resolve(__dirname, "..")
const files = fs
  .readdirSync(src, { recursive: true, encoding: "utf8" })
  .filter((rel) => /\.(tsx?|scss)$/.test(rel) && !rel.startsWith("__tests__"))
  .map((rel) => ({ rel, text: fs.readFileSync(path.join(src, rel), "utf8") }))

it("has no Electron or app coupling", () => {
  const offenders = files
    .filter(({ text }) =>
      /electronAPI|__APP_VERSION__|from ["']electron["']|update-checker/.test(text),
    )
    .map(({ rel }) => rel)
  expect(offenders).toEqual([])
})

it("uses no @/ alias imports", () => {
  const offenders = files
    .filter(({ text }) => /(from|@use|import)\s*["']@\//.test(text))
    .map(({ rel }) => rel)
  expect(offenders).toEqual([])
})
