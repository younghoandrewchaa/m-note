const FRONTMATTER_REGEX = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

export function extractFrontmatter(markdown: string): { frontmatter: string | null; body: string } {
  const match = markdown.match(FRONTMATTER_REGEX)
  if (!match) return { frontmatter: null, body: markdown }
  return {
    frontmatter: match[1],
    body: markdown.slice(match[0].length),
  }
}

export function prependFrontmatter(frontmatter: string, body: string): string {
  return `---\n${frontmatter}\n---\n${body}`
}
