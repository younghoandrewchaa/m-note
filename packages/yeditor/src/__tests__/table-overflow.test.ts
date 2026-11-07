import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const scss = readFileSync(
  resolve(__dirname, '../components/tiptap-node/table-node/table-node.scss'),
  'utf-8'
)

describe('table overflow CSS', () => {
  it('targets .tableWrapper (the Tiptap container div) not the table element for overflow', () => {
    expect(scss).toMatch(/\.tableWrapper/)
  })

  it('applies overflow-x handling to .tableWrapper', () => {
    // overflow: auto or overflow-x: auto on the wrapper allows horizontal scroll as a fallback
    expect(scss).toMatch(/\.tableWrapper[\s\S]*?overflow/)
  })

  it('allows cell content to wrap so tables do not overflow horizontally', () => {
    // word-break or overflow-wrap on th/td prevents content from forcing the table wider
    expect(scss).toMatch(/word-break|overflow-wrap/)
  })

  it('does not place overflow: auto on the table element itself where it has no effect', () => {
    // overflow on <table> is ignored by browsers — the wrapper must handle it
    const tableBlock = scss.match(/\btable\s*\{([^}]+)\}/)
    expect(tableBlock).not.toBeNull()
    expect(tableBlock![1]).not.toContain('overflow: auto')
  })
})
