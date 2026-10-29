import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!
const fetch = vi.hoisted(() => vi.fn())
vi.mock('electron', () => ({
  app: { getVersion: () => '1.0.0' },
  net: { fetch },
}))
import { checkForUpdate } from '../update-checker'
const base = 'https://github.com/younghoandrewchaa/m-note/releases'
const feedName = `update-darwin-${process.arch}.json`
const latestFeed = `${base}/latest/download/${feedName}`
const zipUrl = (version: string, arch: string = process.arch) =>
  `${base}/download/v${version}/M.Note-darwin-${arch}-${version}.zip`
beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
  fetch.mockReset()
})
afterEach(() => {
  Object.defineProperty(process, 'platform', originalPlatform)
})
function feed(version = '2.0.0', overrides: Record<string, unknown> = {}) {
  fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      url: zipUrl(version),
      name: `M Note v${version}`,
      notes: '',
      pub_date: '2026-10-18T00:00:00Z',
      ...overrides,
    }),
  })
}
it('does not depend on the rate-limited GitHub REST API', async () => {
  fetch.mockImplementation(async (url: string) =>
    url.startsWith('https://api.github.com/')
      ? { ok: false, status: 403 }
      : {
          ok: true,
          status: 200,
          json: async () => ({
            url: zipUrl('2.0.0'),
            name: 'M Note v2.0.0',
            notes: '',
            pub_date: '2026-10-18T00:00:00Z',
          }),
        },
  )
  expect(await checkForUpdate()).not.toBeNull()
  expect(fetch).toHaveBeenCalledWith(latestFeed)
})
it('rejects macOS updates on Linux without fetching', async () => {
  Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
  feed()
  await expect(checkForUpdate()).rejects.toThrow('compatible')
  expect(fetch).not.toHaveBeenCalled()
})
it('pins the native feed to the release version', async () => {
  feed()
  expect(await checkForUpdate()).toEqual({
    version: '2.0.0',
    feedUrl: `${base}/download/v2.0.0/${feedName}`,
  })
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('treats a missing feed as not yet available', async () => {
  fetch.mockResolvedValue({ ok: false, status: 404 })
  await expect(checkForUpdate()).rejects.toThrow('compatible')
})
it('rejects wrong architecture', async () => {
  feed('2.0.0', { url: zipUrl('2.0.0', 'other') })
  await expect(checkForUpdate()).rejects.toThrow('metadata')
})
it('returns null only when current', async () => {
  feed('1.0.0')
  expect(await checkForUpdate()).toBeNull()
})
it('reports network errors', async () => {
  fetch.mockRejectedValue(new Error('offline'))
  await expect(checkForUpdate()).rejects.toThrow('offline')
})
it('reports HTTP failure', async () => {
  fetch.mockResolvedValue({ ok: false, status: 503 })
  await expect(checkForUpdate()).rejects.toThrow('503')
})
it('rejects a feed pointing at a different binary', async () => {
  feed('2.0.0', { url: 'https://example.com/wrong.zip' })
  await expect(checkForUpdate()).rejects.toThrow('metadata')
})
it('rejects a feed whose name does not match its version', async () => {
  feed('2.0.0', { name: 'M Note v3.0.0' })
  await expect(checkForUpdate()).rejects.toThrow('metadata')
})
