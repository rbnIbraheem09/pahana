import { app, Menu, type BrowserWindow } from 'electron'

export type AppCommand =
  | 'go:today'
  | 'go:new'
  | 'go:patients'
  | 'go:sync'
  | 'go:cards'
  | 'go:portal'
  | 'go:settings'
  | 'register'
  | 'sync'
  | 'toggle-theme'
  | 'toggle-online'

/**
 * macOS only. The menu lives in the system menu bar at the top of the screen,
 * never inside the window. It keeps the Edit shortcuts (⌘C/⌘V/⌘Z) working and
 * makes the app's own shortcuts discoverable. Windows gets no menu at all.
 */
export function installMacMenu(getWindow: () => BrowserWindow | null): void {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }
  const send = (cmd: AppCommand) => () => getWindow()?.webContents.send('app:command', cmd)
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'Cmd+,', click: send('go:settings') },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        { label: 'New Reading', accelerator: 'Cmd+N', click: send('go:new') },
        { label: 'Register Patient', accelerator: 'Shift+Cmd+N', click: send('register') },
        { type: 'separator' },
        { label: 'Sync Now', accelerator: 'Cmd+Shift+S', click: send('sync') },
        { label: 'Toggle Signal (Online/Offline)', accelerator: 'Cmd+Shift+O', click: send('toggle-online') },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Today', accelerator: 'Cmd+1', click: send('go:today') },
        { label: 'New Reading', accelerator: 'Cmd+2', click: send('go:new') },
        { label: 'Patients', accelerator: 'Cmd+3', click: send('go:patients') },
        { label: 'Sync', accelerator: 'Cmd+4', click: send('go:sync') },
        { label: 'Clinic Cards', accelerator: 'Cmd+5', click: send('go:cards') },
        { label: 'Clinic Portal', accelerator: 'Cmd+6', click: send('go:portal') },
        { type: 'separator' },
        { label: 'Toggle Light / Dark', accelerator: 'Cmd+Shift+L', click: send('toggle-theme') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : ([{ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }] as const)),
      ],
    },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
