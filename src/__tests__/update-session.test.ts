import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { saveUpdateSession, takeUpdateSession, type UpdateSession } from '../update-session'

let dir: string
let a: string
let b: string
const empty: UpdateSession = { files: [], activeFile: null }

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm-note-session-'))
  a = path.join(dir, 'a.md')
  b = path.join(dir, 'b.md')
  fs.writeFileSync(a, '# a')
  fs.writeFileSync(b, '# b')
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('update session', () => {
  it('round-trips files in order with the active file', () => {
    saveUpdateSession(dir, { files: [a, b], activeFile: b })
    expect(takeUpdateSession(dir)).toEqual({ files: [a, b], activeFile: b })
  })

  it('reads the legacy array format', () => {
    fs.writeFileSync(path.join(dir, 'update-session.json'), JSON.stringify([a, b]))
    expect(takeUpdateSession(dir)).toEqual({ files: [a, b], activeFile: null })
  })

  it('drops the active file when it was deleted', () => {
    saveUpdateSession(dir, { files: [a, b], activeFile: b })
    fs.unlinkSync(b)
    expect(takeUpdateSession(dir)).toEqual({ files: [a], activeFile: null })
  })

  it('is consumed once', () => {
    saveUpdateSession(dir, { files: [a], activeFile: a })
    takeUpdateSession(dir)
    expect(takeUpdateSession(dir)).toEqual(empty)
  })

  it.each(['invalid json', '{}', '{"files":"a.md"}'])('ignores malformed content %s', (content) => {
    fs.writeFileSync(path.join(dir, 'update-session.json'), content)
    expect(takeUpdateSession(dir)).toEqual(empty)
  })
})
