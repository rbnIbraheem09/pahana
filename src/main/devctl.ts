import { BrowserWindow } from 'electron'
import { createServer } from 'node:http'

/**
 * Development-only remote control (never runs in a packaged build):
 *   GET  /shot            → PNG of the window's web contents
 *   POST /eval  (body=js) → result of executeJavaScript in the renderer
 *   POST /size  {w,h}     → resize the window
 *   POST /portal {url,w,h} → open the clinic portal in a hidden window (for screenshots)
 *   GET  /portal-shot, POST /portal-eval → capture / script that window
 * Bound to 127.0.0.1 and enabled only when PAHANA_DEVCTL is set.
 */
export function startDevControl(getWindow: () => BrowserWindow | null, port = 4299): void {
  let portal: BrowserWindow | null = null
  const server = createServer(async (req, res) => {
    const win = getWindow()
    if (!win) return void res.writeHead(503).end('no window')
    const body = await new Promise<string>((resolve) => {
      let s = ''
      req.on('data', (c) => (s += c))
      req.on('end', () => resolve(s))
    })
    try {
      if (req.url?.startsWith('/shot')) {
        const img = await win.webContents.capturePage()
        res.writeHead(200, { 'Content-Type': 'image/png' })
        return void res.end(img.toPNG())
      }
      if (req.url?.startsWith('/eval')) {
        const result = await win.webContents.executeJavaScript(body, true)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return void res.end(JSON.stringify(result ?? null))
      }
      if (req.url?.startsWith('/portal-shot')) {
        const img = await portal!.webContents.capturePage()
        res.writeHead(200, { 'Content-Type': 'image/png' })
        return void res.end(img.toPNG())
      }
      if (req.url?.startsWith('/portal-eval')) {
        const result = await portal!.webContents.executeJavaScript(body, true)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return void res.end(JSON.stringify(result ?? null))
      }
      if (req.url?.startsWith('/portal')) {
        const { url, w, h } = JSON.parse(body) as { url: string; w: number; h: number }
        portal?.destroy()
        portal = new BrowserWindow({ width: w, height: h, show: false, useContentSize: true, backgroundColor: '#090F17' })
        await portal.loadURL(url)
        return void res.writeHead(200).end('ok')
      }
      if (req.url?.startsWith('/size')) {
        const { w, h } = JSON.parse(body) as { w: number; h: number }
        win.setSize(w, h)
        return void res.writeHead(200).end('ok')
      }
      res.writeHead(404).end()
    } catch (err) {
      res.writeHead(500).end(String(err))
    }
  })
  server.listen(port, '127.0.0.1')
}
