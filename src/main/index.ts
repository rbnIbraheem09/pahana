import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { generateDemo, type ClinicDB, type FieldDB } from '@shared/seed'
import type { FieldSettings, NewPatientInput, NewReadingInput, RequestLogEntry, Theme } from '@shared/types'
import { ClinicServer } from './clinic/server'
import { ClinicStore } from './clinic/store'
import { FieldStore } from './field/store'
import { SyncClient } from './field/sync'
import { JsonFile } from './lib/jsonFile'
import { startDevControl } from './devctl'
import { installMacMenu } from './menu'
import { applyNativeTheme, createMainWindow } from './window'

app.setName('Pahana')
// Development runs keep their own data so the packaged app always starts from the clean demo.
if (!app.isPackaged) app.setPath('userData', join(app.getPath('appData'), 'Pahana Dev'))
app.setAboutPanelOptions({
  applicationName: 'Pahana',
  applicationVersion: app.getVersion(),
  copyright: 'Offline chronic-disease triage. Prototype. Not for clinical use.',
})

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  let win: BrowserWindow | null = null
  const dataDir = join(app.getPath('userData'), 'data')
  const clinicFile = new JsonFile<ClinicDB>(join(dataDir, 'clinic.json'))
  const fieldFile = new JsonFile<FieldDB>(join(dataDir, 'field.json'))
  const clinic = new ClinicStore(clinicFile)
  const field = new FieldStore(fieldFile)
  let seed: ReturnType<typeof generateDemo> | null = null
  const demo = () => (seed ??= generateDemo())
  clinic.load(() => demo().clinic)
  field.load(() => demo().field)
  seed = null

  const server = new ClinicServer(clinic, join(__dirname, '../renderer'), app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL)
  const sync = new SyncClient(field, () => {
    const s = server.status()
    return s.running ? `http://127.0.0.1:${s.port}` : null
  })

  const send = (channel: string, payload?: unknown) => {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
  }

  /* Push state to the UI ------------------------------------------- */
  field.on('change', (state) => send('field:state', state))
  sync.on('status', (s) => send('sync:status', s))
  sync.on('decisions', (n) => send('sync:decisions', n))
  server.on('status', (s) => send('portal:status', s))
  let requestQueue: RequestLogEntry[] = []
  let requestTimer: NodeJS.Timeout | null = null
  server.on('request', (entry) => {
    requestQueue.push(entry)
    requestTimer ??= setTimeout(() => {
      send('portal:requests', requestQueue)
      requestQueue = []
      requestTimer = null
    }, 120)
  })

  /** Sync opportunistically whenever it could succeed. */
  const kick = () => {
    if (field.settings.autoSync && sync.canSync()) void sync.sync()
  }

  /* IPC ------------------------------------------------------------ */
  ipcMain.handle('field:get', () => field.state())
  ipcMain.handle('field:register', (_e, input: NewPatientInput) => {
    const p = field.registerPatient(input)
    kick()
    return p
  })
  ipcMain.handle('field:reading', (_e, input: NewReadingInput) => {
    const r = field.addReading(input)
    setTimeout(kick, 900) // let the "saved" moment land before the outbox drains
    return r
  })
  ipcMain.handle('field:online', (_e, online: boolean) => {
    field.setOnline(online)
    if (online) setTimeout(kick, 350)
  })
  ipcMain.handle('field:settings', (_e, patch: Partial<FieldSettings>) => {
    field.updateSettings(patch)
    if (patch.theme) applyNativeTheme(win, patch.theme)
    if (patch.autoSync) kick()
  })
  ipcMain.handle('field:profile', (_e, patch) => field.updateProfile(patch))

  ipcMain.handle('sync:get', () => sync.current())
  ipcMain.handle('sync:now', () => sync.sync())

  ipcMain.handle('portal:get', () => server.status())
  ipcMain.handle('portal:start', async (_e, lan?: boolean) => {
    const s = await server.start(lan)
    setTimeout(kick, 400)
    return s
  })
  ipcMain.handle('portal:stop', () => server.stop())
  ipcMain.handle('portal:lan', async (_e, lan: boolean) => (server.status().running ? server.start(lan) : server.status()))
  ipcMain.handle('portal:open', () => {
    const url = server.status().pairUrl
    if (url) void shell.openExternal(url)
  })

  ipcMain.handle('app:open-external', (_e, url: string) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
  })
  ipcMain.handle('app:reset-demo', () => {
    const fresh = generateDemo()
    const { settings } = field.state()
    clinic.replace(fresh.clinic)
    field.replace({ ...fresh.field, settings })
  })
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform }))
  ipcMain.handle('win:state', () => ({
    fullscreen: win?.isFullScreen() ?? false,
    focused: win?.isFocused() ?? true,
  }))

  /* Window --------------------------------------------------------- */
  const openWindow = () => {
    const theme: Theme = field.settings.theme
    win = createMainWindow(theme, join(__dirname, '../preload/index.js'))
    const pushWinState = () => send('win:state', { fullscreen: win?.isFullScreen() ?? false, focused: win?.isFocused() ?? true })
    win.on('enter-full-screen', pushWinState)
    win.on('leave-full-screen', pushWinState)
    win.on('focus', pushWinState)
    win.on('blur', pushWinState)
    win.on('closed', () => {
      win = null
    })
  }

  app.on('second-instance', () => {
    if (!win) return openWindow()
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId('lk.pahana.app')
    const devIcon = join(__dirname, '../../build/icon.png')
    if (process.platform === 'darwin' && !app.isPackaged && existsSync(devIcon)) app.dock?.setIcon(devIcon)
    installMacMenu(() => win)
    openWindow()
    sync.startPolling()
    if (field.settings.portalOnLaunch) void server.start(false).catch((err) => console.error('[clinic]', err))
    if (!app.isPackaged && process.env.PAHANA_DEVCTL) startDevControl(() => win)
    app.on('activate', () => {
      if (!BrowserWindow.getAllWindows().length) openWindow()
    })
  })

  // macOS convention: closing the window keeps the app (and the clinic portal) running.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    sync.stopPolling()
    void server.stop(false)
    clinic.flush()
    field.flush()
  })
}
