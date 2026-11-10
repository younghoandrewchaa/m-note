import path from 'node:path'

export interface TabDocument {
  id: number
  filePath: string | null
  dirty: boolean
  untitledNumber: number | null
}

export type OpenTarget =
  | { kind: 'focus'; id: number }
  | { kind: 'reuse'; id: number }
  | { kind: 'new' }

export function chooseOpenTarget(filePath: string, tabs: TabDocument[], anchorId: number | null): OpenTarget {
  const resolved = path.resolve(filePath)
  const existing = tabs.find((tab) => tab.filePath !== null && path.resolve(tab.filePath) === resolved)
  if (existing) return { kind: 'focus', id: existing.id }

  const anchor = tabs.find((tab) => tab.id === anchorId)
  if (anchor && anchor.filePath === null && !anchor.dirty) return { kind: 'reuse', id: anchor.id }

  return { kind: 'new' }
}

export function nextUntitledNumber(tabs: TabDocument[]): number {
  const used = new Set(tabs.map((tab) => tab.untitledNumber))
  let number = 1
  while (used.has(number)) number++
  return number
}

export function tabTitle(doc: Pick<TabDocument, 'filePath' | 'dirty' | 'untitledNumber'>): string {
  const name = doc.filePath !== null
    ? path.basename(doc.filePath)
    : doc.untitledNumber !== null && doc.untitledNumber > 1
      ? `Untitled ${doc.untitledNumber}`
      : 'Untitled'
  return doc.dirty ? `● ${name}` : name
}
