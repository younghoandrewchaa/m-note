// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { UpdateBanner } from '../components/update-banner'
import { newerUpdateState } from '../hooks/use-app-update'
import type { UpdateState } from '../update-state'
it('renders native actions and never a download link', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div'),
    root = createRoot(host)
  const check = vi.fn(),
    install = vi.fn()
  const states: UpdateState[] = [
    { status: 'checking', revision: 1 },
    { status: 'downloading', version: '2.0.0', revision: 2 },
    { status: 'ready', version: '2.0.0', revision: 3 },
    { status: 'error', message: 'Offline', retryable: true, revision: 4 },
    { status: 'unsupported', revision: 5 },
  ]
  for (const state of states) {
    act(() =>
      root.render(
        <UpdateBanner state={state} check={check} install={install} />,
      ),
    )
    expect(host.querySelector('a')).toBeNull()
    expect(
      [...host.querySelectorAll('button')].some(
        (b) => b.textContent === 'Download',
      ),
    ).toBe(false)
    if (state.status === 'ready') {
      expect(host.textContent).toContain('Restart & Install')
      act(() => host.querySelector('button')!.click())
      expect(install).toHaveBeenCalledOnce()
    }
    if (state.status === 'error') {
      act(() => host.querySelector('button')!.click())
      expect(check).toHaveBeenCalledOnce()
    }
  }
  act(() => root.unmount())
  vi.unstubAllGlobals()
})
it('ignores stale snapshots after a downloaded event', () => {
  const ready: UpdateState = { status: 'ready', version: '2.0.0', revision: 3 }
  expect(newerUpdateState(ready, { status: 'checking', revision: 1 })).toBe(
    ready,
  )
})
it('renders nothing while checking or when already up to date', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div'),
    root = createRoot(host)
  const render = (state: UpdateState) =>
    act(() =>
      root.render(
        <UpdateBanner state={state} check={vi.fn()} install={vi.fn()} />,
      ),
    )
  render({ status: 'checking', revision: 1 })
  expect(host.querySelector('.update-banner')).toBeNull()
  render({ status: 'up-to-date', revision: 2 })
  expect(host.querySelector('.update-banner')).toBeNull()
  act(() => root.unmount())
  vi.unstubAllGlobals()
})
it('renders nothing when native updates are unsupported (dev builds)', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div'),
    root = createRoot(host)
  act(() =>
    root.render(
      <UpdateBanner
        state={{ status: 'unsupported', revision: 1 }}
        check={vi.fn()}
        install={vi.fn()}
      />,
    ),
  )
  expect(host.querySelector('.update-banner')).toBeNull()
  act(() => root.unmount())
  vi.unstubAllGlobals()
})
