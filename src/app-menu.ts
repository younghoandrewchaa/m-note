import type { MenuItemConstructorOptions } from 'electron'

export function buildAppMenuTemplate(actions: { newTab: () => void }): MenuItemConstructorOptions[] {
  return [
    { role: 'appMenu' },
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => actions.newTab() },
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => actions.newTab() },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'selectPreviousTab', accelerator: 'Cmd+Shift+[' },
        { role: 'selectNextTab', accelerator: 'Cmd+Shift+]' },
        { role: 'showAllTabs' },
        { role: 'mergeAllWindows' },
        { role: 'moveTabToNewWindow' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ]
}
