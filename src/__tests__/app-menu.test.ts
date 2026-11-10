import { describe, it, expect, vi } from 'vitest'
import type { MenuItemConstructorOptions } from 'electron'
import { buildAppMenuTemplate } from '../app-menu'

function flatten(items: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return items.flatMap((item) => [
    item,
    ...(Array.isArray(item.submenu) ? flatten(item.submenu) : []),
  ])
}

function setup() {
  const newTab = vi.fn()
  const items = flatten(buildAppMenuTemplate({ newTab }))
  return { newTab, items }
}

describe('buildAppMenuTemplate', () => {
  it('binds tab switching to Cmd+Shift+[ and ]', () => {
    const { items } = setup()
    expect(items.find((i) => i.role === 'selectPreviousTab')?.accelerator).toBe('Cmd+Shift+[')
    expect(items.find((i) => i.role === 'selectNextTab')?.accelerator).toBe('Cmd+Shift+]')
  })

  it('Cmd+T and Cmd+N both open a new tab', () => {
    const { newTab, items } = setup()
    for (const accelerator of ['CmdOrCtrl+T', 'CmdOrCtrl+N']) {
      newTab.mockClear()
      const item = items.find((i) => i.accelerator === accelerator)
      expect(item).toBeDefined()
      ;(item!.click as () => void)()
      expect(newTab).toHaveBeenCalledTimes(1)
    }
  })

  it('Cmd+W closes the tab', () => {
    const { items } = setup()
    expect(items.some((i) => i.role === 'close')).toBe(true)
  })

  it('keeps edit and view menus', () => {
    const { items } = setup()
    for (const role of ['appMenu', 'editMenu', 'viewMenu']) {
      expect(items.some((i) => i.role === role)).toBe(true)
    }
  })

  it('has no Cmd+1…9 shortcuts', () => {
    const { items } = setup()
    const accelerators = items.flatMap((i) => (i.accelerator ? [String(i.accelerator)] : []))
    expect(accelerators.filter((a) => /\+[1-9]$/.test(a))).toEqual([])
  })
})
