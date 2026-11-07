import postcss from "postcss"

const GLOBAL_SELECTOR = /^(html|body|\*|#root|#app)(?![\w-])/

/** Returns the selectors in css that would style the host page instead of the editor. */
export function findGlobalSelectors(css: string): string[] {
  const found: string[] = []
  postcss.parse(css).walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/.test((rule.parent as postcss.AtRule).name)) return
    for (const raw of rule.selectors) {
      const selector = raw.trim()
      if (GLOBAL_SELECTOR.test(selector) || selector.startsWith("::-webkit-scrollbar")) {
        found.push(selector)
      }
    }
  })
  return found
}
