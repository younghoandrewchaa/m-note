import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDebouncedWindowBoundsWriter,
  getDefaultWindowBounds,
  isValidWindowBounds,
  readWindowBounds,
  writeWindowBounds,
} from '../window-state'

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}))

vi.mock('node:path', () => ({
  default: { join: vi.fn((...parts: string[]) => parts.join('/')) },
}))

const userDataPath = '/user/data'
const workAreas = [{ x: 0, y: 0, width: 1440, height: 900 }]

describe('window-state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the existing half-screen default bounds', () => {
    expect(getDefaultWindowBounds({ width: 1440, height: 900 })).toEqual({
      x: 0,
      y: 0,
      width: 720,
      height: 900,
    })
  })

  it('reads valid saved bounds from userData/window-state.json', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ x: 40, y: 50, width: 900, height: 700 }),
    )

    expect(readWindowBounds(userDataPath, workAreas)).toEqual({
      x: 40,
      y: 50,
      width: 900,
      height: 700,
    })
    expect(path.join).toHaveBeenCalledWith(userDataPath, 'window-state.json')
  })

  it('returns null when the state file is missing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    expect(readWindowBounds(userDataPath, workAreas)).toBeNull()
    expect(fs.readFileSync).not.toHaveBeenCalled()
  })

  it('returns null when saved JSON is malformed', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('{not-json')

    expect(readWindowBounds(userDataPath, workAreas)).toBeNull()
  })

  it('rejects non-finite numeric fields and too-small dimensions', () => {
    expect(isValidWindowBounds({ x: 0, y: 0, width: 319, height: 500 }, workAreas)).toBe(false)
    expect(isValidWindowBounds({ x: 0, y: 0, width: 500, height: 239 }, workAreas)).toBe(false)
    expect(isValidWindowBounds({ x: Number.NaN, y: 0, width: 500, height: 500 }, workAreas)).toBe(false)
    expect(isValidWindowBounds({ x: 0, y: Infinity, width: 500, height: 500 }, workAreas)).toBe(false)
  })

  it('rejects saved bounds entirely outside all current display work areas', () => {
    expect(isValidWindowBounds({ x: 2000, y: 100, width: 800, height: 600 }, workAreas)).toBe(false)
  })

  it('accepts saved bounds that intersect a current display work area', () => {
    expect(isValidWindowBounds({ x: 1400, y: 100, width: 800, height: 600 }, workAreas)).toBe(true)
  })

  it('writes bounds JSON to userData/window-state.json', () => {
    writeWindowBounds(userDataPath, { x: 10, y: 20, width: 800, height: 600 })

    expect(fs.mkdirSync).toHaveBeenCalledWith(userDataPath, { recursive: true })
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/user/data/window-state.json',
      JSON.stringify({ x: 10, y: 20, width: 800, height: 600 }, null, 2),
      'utf-8',
    )
  })

  it('debounces repeated writes and persists the latest bounds', () => {
    vi.useFakeTimers()
    const write = createDebouncedWindowBoundsWriter(userDataPath, 250)

    write({ x: 1, y: 2, width: 800, height: 600 })
    write({ x: 3, y: 4, width: 900, height: 700 })

    vi.advanceTimersByTime(249)
    expect(fs.writeFileSync).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/user/data/window-state.json',
      JSON.stringify({ x: 3, y: 4, width: 900, height: 700 }, null, 2),
      'utf-8',
    )
  })

  it('flush writes pending bounds immediately without waiting for the debounce timer', () => {
    vi.useFakeTimers()
    const write = createDebouncedWindowBoundsWriter(userDataPath, 250)

    write({ x: 5, y: 6, width: 1000, height: 800 })
    write.flush()

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/user/data/window-state.json',
      JSON.stringify({ x: 5, y: 6, width: 1000, height: 800 }, null, 2),
      'utf-8',
    )

    // The debounce timer should be cancelled, so it must not write again.
    vi.mocked(fs.writeFileSync).mockClear()
    vi.advanceTimersByTime(250)
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('flush is a no-op when there is no pending write', () => {
    const write = createDebouncedWindowBoundsWriter(userDataPath, 250)

    write.flush()

    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })
})
