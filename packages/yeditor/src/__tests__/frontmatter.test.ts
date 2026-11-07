import { describe, it, expect } from 'vitest'
import { extractFrontmatter, prependFrontmatter } from '../lib/frontmatter'

describe('extractFrontmatter', () => {
  it('extracts YAML frontmatter from markdown', () => {
    const md = `---\ntitle: Hello\ntags: [a, b]\n---\n# Content`
    const result = extractFrontmatter(md)
    expect(result.frontmatter).toBe('title: Hello\ntags: [a, b]')
    expect(result.body).toBe('# Content')
  })

  it('returns null for files without frontmatter', () => {
    const md = '# Just a heading\n\nSome text.'
    const result = extractFrontmatter(md)
    expect(result.frontmatter).toBeNull()
    expect(result.body).toBe(md)
  })

  it('handles empty frontmatter', () => {
    const md = '---\n\n---\nBody'
    const result = extractFrontmatter(md)
    expect(result.frontmatter).toBe('')
    expect(result.body).toBe('Body')
  })

  it('handles Windows line endings', () => {
    const md = '---\r\ntitle: Test\r\n---\r\nBody'
    const result = extractFrontmatter(md)
    expect(result.frontmatter).toBe('title: Test')
    expect(result.body).toBe('Body')
  })

  it('does not treat --- later in the document as frontmatter', () => {
    const md = '# Title\n\n---\n\nSome text after hr'
    const result = extractFrontmatter(md)
    expect(result.frontmatter).toBeNull()
    expect(result.body).toBe(md)
  })

  it('handles frontmatter with multiline values', () => {
    const md = '---\ndescription: |\n  This is a\n  multiline value\n---\n# Doc'
    const result = extractFrontmatter(md)
    expect(result.frontmatter).toBe('description: |\n  This is a\n  multiline value')
    expect(result.body).toBe('# Doc')
  })
})

describe('prependFrontmatter', () => {
  it('creates valid frontmatter markdown', () => {
    const result = prependFrontmatter('title: Hello', '# Content')
    expect(result).toBe('---\ntitle: Hello\n---\n# Content')
  })
})

describe('round-trip', () => {
  it('extract then prepend yields original content', () => {
    const original = '---\ntitle: Test\ntags: [a, b]\n---\n# Hello World\n\nBody text.'
    const { frontmatter, body } = extractFrontmatter(original)
    const reconstructed = prependFrontmatter(frontmatter!, body)
    expect(reconstructed).toBe(original)
  })
})
