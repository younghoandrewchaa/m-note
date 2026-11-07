// Verifies the library build output: entry, types, and a stylesheet that doesn't leak onto the host page.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { findGlobalSelectors } from "./css-guard.mjs"

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist")
const problems = []
const read = (name) => {
  const file = path.join(dist, name)
  if (!fs.existsSync(file)) {
    problems.push(`dist/${name} missing`)
    return ""
  }
  return fs.readFileSync(file, "utf8")
}

const js = read("index.js")
const dts = read("index.d.ts")
const css = read("style.css")

if (js) {
  // Next.js App Router needs this to use the editor from a Server Component tree.
  if (!/^["']use client["']/.test(js)) problems.push('index.js does not start with "use client"')
  if (!/from\s*["']react["']/.test(js)) problems.push("index.js does not import react as an external")
  if (/react-dom\/cjs|@tiptap\/core\/dist/.test(js)) problems.push("index.js bundles a dependency")
}
if (dts) {
  for (const name of ["YEditorProps", "YEditorHandle"]) {
    if (!dts.includes(name)) problems.push(`index.d.ts does not mention ${name}`)
  }
}
if (css) {
  const globals = findGlobalSelectors(css)
  if (globals.length) problems.push(`style.css has global selectors: ${globals.join(", ")}`)
  if (css.includes("fonts.googleapis.com")) problems.push("style.css imports remote fonts")
}

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join("\n"))
  process.exit(1)
}
console.log("✓ dist OK")
