import { app, BrowserWindow, Menu, nativeTheme, screen, shell } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Theme } from '@shared/types'

const isMac = process.platform === 'darwin'

/**
 * Height of the in-app top row on Windows (the native caption buttons sit in it).
 * On macOS the top row is 60px and the traffic lights are centred in it (y = 23 → centre ≈ 30).
 */
export const HEADER_HEIGHT = 48

/** Windows: the caption buttons sit on the content panel, so they share its exact colour. */
const PANEL_BG: Record<Theme, string> = { night: '#101722', day: '#FBFDFF' }
const SYMBOL: Record<Theme, string> = { night: '#C5CEDD', day: '#243044' }

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

const statePath = () => join(app.getPath('userData'), 'window-state.json')

function loadState(): WindowState {
  const fallback: WindowState = { width: 1360, height: 880, maximized: false }
  try {
    const s = JSON.parse(readFileSync(statePath(), 'utf8')) as WindowState
    // Only restore a position that is still on a connected display.
    if (s.x != null && s.y != null) {
      const area = screen.getDisplayMatching({ x: s.x, y: s.y, width: s.width, height: s.height }).workArea
      const visible =
        s.x + 80 < area.x + area.width && s.x + s.width - 80 > area.x && s.y >= area.y - 10 && s.y + 40 < area.y + area.height
      if (!visible) return { ...fallback, width: s.width, height: s.height }
    }
    return { ...fallback, ...s }
  } catch {
    return fallback
  }
}

function trackState(win: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null
  const save = () => {
    if (win.isDestroyed() || win.isFullScreen() || win.isMinimized()) return
    const maximized = win.isMaximized()
    const b = win.getNormalBounds()
    try {
      writeFileSync(statePath(), JSON.stringify({ ...b, maximized } satisfies WindowState))
    } catch {
      /* non-fatal */
    }
  }
  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(save, 400)
  }
  win.on('resize', schedule)
  win.on('move', schedule)
  win.on('maximize', schedule)
  win.on('unmaximize', schedule)
  win.on('close', save)
}

export function createMainWindow(theme: Theme, preload: string): BrowserWindow {
  const state = loadState()
  nativeTheme.themeSource = theme === 'day' ? 'light' : 'dark'

  const win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    title: 'Pahana',
    // No title bar strip: the app's own top row is the draggable surface.
    titleBarStyle: 'hidden',
    ...(isMac
      ? {
          trafficLightPosition: { x: 20, y: 23 },
          // Native translucent sidebar material; the content panel paints its own opaque surface.
          vibrancy: 'sidebar' as const,
          visualEffectState: 'followWindow' as const,
          backgroundColor: '#00000000',
        }
      : {
          titleBarOverlay: { color: PANEL_BG[theme], symbolColor: SYMBOL[theme], height: HEADER_HEIGHT },
          backgroundColor: PANEL_BG[theme],
        }),
    webPreferences: {
      preload,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false,
    },
  })

  if (state.maximized) win.maximize()
  trackState(win)

  // Invisible menus on Windows/Linux: nothing is drawn, not even on Alt.
  if (!isMac) win.removeMenu()

  win.once('ready-to-show', () => win.show())
  win.webContents.setVisualZoomLevelLimits(1, 1)

  // Links open in the user's browser; the app window never navigates away.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    const dev = process.env.ELECTRON_RENDERER_URL
    if (!(dev && url.startsWith(dev))) e.preventDefault()
  })

  // Native context menu for text fields and selections (Electron ships none by default).
  win.webContents.on('context-menu', (_e, params) => {
    const { isEditable, selectionText, editFlags } = params
    if (!isEditable && !selectionText.trim()) return
    const template: Electron.MenuItemConstructorOptions[] = isEditable
      ? [
          { role: 'undo', enabled: editFlags.canUndo },
          { role: 'redo', enabled: editFlags.canRedo },
          { type: 'separator' },
          { role: 'cut', enabled: editFlags.canCut },
          { role: 'copy', enabled: editFlags.canCopy },
          { role: 'paste', enabled: editFlags.canPaste },
          { type: 'separator' },
          { role: 'selectAll' },
        ]
      : [{ role: 'copy' }]
    Menu.buildFromTemplate(template).popup({ window: win })
  })

  // Dev-only DevTools shortcut (production has no way to open them).
  if (!app.isPackaged) {
    win.webContents.on('before-input-event', (_e, input) => {
      const toggle = input.type === 'keyDown' && (input.key === 'F12' || (input.key.toLowerCase() === 'i' && input.alt && (input.meta || input.control)))
      if (toggle) win.webContents.toggleDevTools()
    })
  }

  const url = process.env.ELECTRON_RENDERER_URL
  if (!app.isPackaged && url) void win.loadURL(url)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))

  return win
}

/** Keep native surfaces (vibrancy material, caption buttons) in step with the app theme. */
export function applyNativeTheme(win: BrowserWindow | null, theme: Theme): void {
  nativeTheme.themeSource = theme === 'day' ? 'light' : 'dark'
  if (!win || win.isDestroyed()) return
  if (!isMac) {
    win.setBackgroundColor(PANEL_BG[theme])
    win.setTitleBarOverlay({ color: PANEL_BG[theme], symbolColor: SYMBOL[theme], height: HEADER_HEIGHT })
  }
}
