// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { findInlineCodeElement, computeButtonPosition } from '../lib/inline-code-copy'

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

describe('computeButtonPosition', () => {
  const viewport = { width: 1000, height: 800 }
  const size = 22

  it('places the button above the span and right-aligned to it', () => {
    const rect = { top: 100, right: 150, bottom: 120, left: 50 }
    expect(computeButtonPosition(rect, size, viewport)).toEqual({ top: 74, left: 128 })
  })

  it('flips below the span when there is no room above', () => {
    const rect = { top: 10, right: 150, bottom: 30, left: 50 }
    expect(computeButtonPosition(rect, size, viewport)).toEqual({ top: 34, left: 128 })
  })

  it('clamps the left edge when the span sits at the left margin', () => {
    const rect = { top: 100, right: 10, bottom: 120, left: 2 }
    expect(computeButtonPosition(rect, size, viewport)).toEqual({ top: 74, left: 0 })
  })

  it('clamps the right edge when the span overflows the viewport', () => {
    const rect = { top: 100, right: 1010, bottom: 120, left: 900 }
    expect(computeButtonPosition(rect, size, viewport)).toEqual({ top: 74, left: 978 })
  })

  it('flips below the span when it sits under a non-zero topBoundary', () => {
    const rect = { top: 50, right: 150, bottom: 70, left: 50 }
    // Room above the viewport top (50 - 22 - 4 = 24 >= 0), but not above a
    // topBoundary of 44 (e.g. a sticky toolbar), so it must flip below.
    expect(computeButtonPosition(rect, size, viewport, 44)).toEqual({ top: 74, left: 128 })
  })
})
