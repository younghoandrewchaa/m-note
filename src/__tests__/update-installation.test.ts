import { beforeEach, expect, it, vi } from 'vitest'
const prepare = vi.hoisted(() => vi.fn())
vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: vi.fn() },
}))
vi.mock('../window-close-handler', () => ({
  prepareWindowForClose: prepare,
  approveWindowClose: vi.fn(),
  resetWindowClose: vi.fn(),
  setWindowFrozen: vi.fn().mockResolvedValue(undefined),
}))
import { prepareWindowsForUpdate } from '../update-installation'
const windows = [
  { isDestroyed: () => false },
  { isDestroyed: () => false },
] as any
beforeEach(() => {
  prepare.mockReset()
})
it('aborts before closing any window if any preparation is cancelled', async () => {
  prepare.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
  expect(await prepareWindowsForUpdate(windows, () => windows)).toBe(false)
  expect(windows).toHaveLength(2)
})
it('prepares all windows before approving installation', async () => {
  prepare.mockResolvedValue(true)
  expect(await prepareWindowsForUpdate(windows, () => windows)).toBe(true)
  expect(prepare).toHaveBeenCalledTimes(2)
})
it('aborts if a new window opens', async () => {
  prepare.mockResolvedValue(true)
  expect(
    await prepareWindowsForUpdate(windows, () => [...windows, {}] as any),
  ).toBe(false)
})
it('restores windows after a failed save', async () => {
  prepare.mockRejectedValue(new Error('write failed'))
  await expect(prepareWindowsForUpdate(windows, () => windows)).rejects.toThrow(
    'write failed',
  )
})
