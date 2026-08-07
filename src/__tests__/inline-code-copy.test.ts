// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { findInlineCodeElement } from '../lib/inline-code-copy'

function render(html: string): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = html
  return container
}

describe('findInlineCodeElement', () => {
  it('returns the code element when the target is the element itself', () => {
    const container = render('<p>Run <code>npm start</code> now</p>')
    const code = container.querySelector('code')!
    expect(findInlineCodeElement(code)).toBe(code)
  })

  it('returns the ancestor code element when the target is nested inside it', () => {
    const container = render('<p>Run <code><span class="hl">npm</span> start</code></p>')
    const code = container.querySelector('code')!
    const span = container.querySelector('span.hl')!
    expect(findInlineCodeElement(span)).toBe(code)
  })

  it('returns null for a code element inside a pre (code blocks keep their own button)', () => {
    const container = render('<pre><code>const x = 1</code></pre>')
    const code = container.querySelector('code')!
    expect(findInlineCodeElement(code)).toBeNull()
  })

  it('returns null for a plain paragraph', () => {
    const container = render('<p>no code here</p>')
    const paragraph = container.querySelector('p')!
    expect(findInlineCodeElement(paragraph)).toBeNull()
  })

  it('returns null for a null target', () => {
    expect(findInlineCodeElement(null)).toBeNull()
  })
})
