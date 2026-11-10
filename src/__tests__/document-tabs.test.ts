import { describe, it, expect } from 'vitest'
import { chooseOpenTarget, nextUntitledNumber, tabTitle } from '../document-tabs'

const doc = (id: number, filePath: string | null, dirty = false, untitledNumber: number | null = filePath ? null : 1) =>
  ({ id, filePath, dirty, untitledNumber })

describe('chooseOpenTarget', () => {
  it('focuses a tab that already has the file', () =>
    expect(chooseOpenTarget('/d/a.md', [doc(1, '/d/a.md'), doc(2, null)], 2)).toEqual({ kind: 'focus', id: 1 }))
  it('matches the same file under a different spelling', () =>
    expect(chooseOpenTarget('/d/x/../a.md', [doc(1, '/d/a.md')], 1)).toEqual({ kind: 'focus', id: 1 }))
  it('reuses an unedited untitled anchor tab', () =>
    expect(chooseOpenTarget('/d/a.md', [doc(1, null)], 1)).toEqual({ kind: 'reuse', id: 1 }))
  it('does not reuse an edited untitled tab', () =>
    expect(chooseOpenTarget('/d/a.md', [doc(1, null, true)], 1)).toEqual({ kind: 'new' }))
  it('does not reuse a saved document', () =>
    expect(chooseOpenTarget('/d/b.md', [doc(1, '/d/a.md')], 1)).toEqual({ kind: 'new' }))
  it('opens a new tab when there is no anchor', () =>
    expect(chooseOpenTarget('/d/a.md', [doc(1, null)], null)).toEqual({ kind: 'new' }))
})

describe('nextUntitledNumber', () => {
  it('starts at 1', () => expect(nextUntitledNumber([])).toBe(1))
  it('fills the lowest gap', () => expect(nextUntitledNumber([doc(1, null, false, 1), doc(2, null, false, 3)])).toBe(2))
  it('ignores saved documents', () => expect(nextUntitledNumber([doc(1, '/d/a.md')])).toBe(1))
})

describe('tabTitle', () => {
  it('uses the file name', () => expect(tabTitle(doc(1, '/d/a.md'))).toBe('a.md'))
  it('prefixes unsaved changes', () => expect(tabTitle(doc(1, '/d/a.md', true))).toBe('● a.md'))
  it('labels the first untitled tab', () => expect(tabTitle(doc(1, null, false, 1))).toBe('Untitled'))
  it('numbers later untitled tabs', () => expect(tabTitle(doc(1, null, true, 2))).toBe('● Untitled 2'))
})
