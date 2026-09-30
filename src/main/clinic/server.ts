import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'
import { createServer, request as httpRequest, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { networkInterfaces } from 'node:os'
import { extname, join, normalize } from 'node:path'
import { isCardId, normaliseCardId } from '@shared/random'
import { RULE_TABLE, RULES_VERSION } from '@shared/triage'
import type { DecisionAction, PortalStatus, RequestLogEntry, SyncRequest } from '@shared/types'
import { HttpError, type ClinicStore } from './store'

const PORTS = [4280, 4281, 4282, 4283, 4284, 4285]
const COOKIE = 'pahana_session'
const MAX_BODY = 5 * 1024 * 1024

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json',
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
}

const CSP =
  "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"

interface Session {
  token: string
  actor: string
  createdAt: number
}

type ServerEvents = {
  status: [PortalStatus]
  request: [RequestLogEntry]
}

/**
 * The clinic portal server: static portal app + JSON API + server-sent events.
 * Bound to localhost by default; LAN mode binds 0.0.0.0 so a tablet or phone
 * on the same Wi-Fi can open the portal.
 */
export class ClinicServer extends EventEmitter<ServerEvents> {
  private server: Server | null = null
  private port: number | null = null
  private lan = false
  private pairCode: string | null = null
  private startedAt: string | null = null
  private sessions = new Map<string, Session>()
  private clients = new Set<ServerResponse>()
  private heartbeat: NodeJS.Timeout | null = null
  private reqId = 0
  /** Background sync polls that carried nothing are not worth showing in the request log. */
  private quiet = new WeakSet<ServerResponse>()

  constructor(
    private readonly store: ClinicStore,
    private readonly staticRoot: string,
    private readonly devUrl: string | undefined,
  ) {
    super()
    store.on('summaries', (summaries) => this.broadcast('summaries', summaries))
    store.on('activity', (ev) => this.broadcast('activity', ev))
    store.on('stats', (stats) => this.broadcast('stats', stats))
    store.on('reset', () => this.broadcast('reset', {}))
  }

  status(): PortalStatus {
    const running = !!this.server && this.port != null
    const lanIp = this.lan ? lanAddress() : null
    const localUrl = running ? `http://localhost:${this.port}` : null
    const lanUrl = running && lanIp ? `http://${lanIp}:${this.port}` : null
    return {
      running,
      port: this.port,
      lan: this.lan,
      localUrl,
      lanUrl,
      pairCode: running ? this.pairCode : null,
      pairUrl: this.pairingUrl(localUrl),
      lanPairUrl: this.pairingUrl(lanUrl),
      viewers: this.clients.size,
      startedAt: this.startedAt,
    }
  }

  /** URL that pairs the browser automatically (used by "Open in browser" and the QR code). */
  private pairingUrl(base: string | null): string | null {
    return base && this.pairCode ? `${base}/?pair=${this.pairCode}` : null
  }

  async start(lan = this.lan): Promise<PortalStatus> {
    if (this.server) await this.stop(false)
    this.lan = lan
    const host = lan ? '0.0.0.0' : '127.0.0.1'
    let lastError: unknown = null
    for (const port of PORTS) {
      try {
        const server = createServer((req, res) => void this.handle(req, res))
        server.keepAliveTimeout = 5000
        await new Promise<void>((resolve, reject) => {
          server.once('error', reject)
          server.listen(port, host, () => {
            server.off('error', reject)
            resolve()
          })
        })
        this.server = server
        this.port = port
        break
      } catch (err) {
        lastError = err
      }
    }
    if (!this.server) throw lastError ?? new Error('No free port for the clinic portal')
    this.pairCode = String(randomInt(0, 1_000_000)).padStart(6, '0')
    this.startedAt = new Date().toISOString()
    this.heartbeat = setInterval(() => {
      for (const c of this.clients) c.write(': ping\n\n')
    }, 15_000)
    this.store.audit('portal', 'System', `Clinic portal started on ${lan ? 'local network' : 'this computer'}`)
    this.emitStatus()
    return this.status()
  }

  async stop(log = true): Promise<PortalStatus> {
    if (this.heartbeat) clearInterval(this.heartbeat)
    this.heartbeat = null
    for (const c of this.clients) c.end()
    this.clients.clear()
    const server = this.server
    this.server = null
    this.port = null
    this.pairCode = null
    this.startedAt = null
    if (server) {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      if (log) this.store.audit('portal', 'System', 'Clinic portal stopped')
    }
    this.emitStatus()
    return this.status()
  }

  /* ---------------------------------------------------------------- */

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const started = performance.now()
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname
    res.on('finish', () => {
      if (path === '/api/events' || this.quiet.has(res)) return
      this.emit('request', {
        id: ++this.reqId,
        t: Date.now(),
        method: req.method ?? 'GET',
        path,
        status: res.statusCode,
        ms: Math.round((performance.now() - started) * 10) / 10,
      })
    })
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v)

    try {
      if (path.startsWith('/api/')) return await this.api(req, res, url)
      return await this.serveStatic(req, res, url)
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500
      if (status === 500) console.error('[clinic]', err)
      json(res, status, { error: err instanceof Error ? err.message : 'Server error' })
    }
  }

  private async api(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const path = url.pathname
    const method = req.method ?? 'GET'

    if (path === '/api/health') return json(res, 200, { ok: true, name: 'Nexa Health Clinic', rules: RULES_VERSION })

    // Device sync is authenticated with the device's HMAC key, not a browser session.
    if (path === '/api/sync' && method === 'POST') {
      const raw = await readBody(req)
      const deviceId = String(req.headers['x-pahana-device'] ?? '')
      const signature = String(req.headers['x-pahana-signature'] ?? '')
      const device = this.store.devices.find((d) => d.id === deviceId)
      if (!device || !verify(device.secret, raw, signature)) throw new HttpError(401, 'Signature check failed')
      const body = JSON.parse(raw.toString('utf8')) as SyncRequest
      const result = this.store.ingestSync({ ...body, deviceId })
      if (!body.readings?.length && !body.patients?.length && !result.decisions.length) this.quiet.add(res)
      return json(res, 200, result)
    }

    if (path === '/api/session' && method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}') as { code?: string }
      if (!this.pairCode || String(body.code ?? '').replace(/\D/g, '') !== this.pairCode) {
        await delay(350)
        throw new HttpError(401, 'That code doesn’t match. Check the code shown in Nexa Health on the clinic computer.')
      }
      const s = this.createSession()
      setSessionCookie(res, s.token)
      return json(res, 200, { ok: true, actor: s.actor, clinic: this.store.clinic })
    }

    const session = this.session(req)
    if (!session) throw new HttpError(401, 'Not paired')

    if (path === '/api/session' && method === 'GET') return json(res, 200, { actor: session.actor, clinic: this.store.clinic })
    if (path === '/api/bootstrap') return json(res, 200, this.store.bootstrap())
    if (path === '/api/events') return this.subscribe(req, res)
    if (path === '/api/activity') return json(res, 200, this.store.activity(Number(url.searchParams.get('limit') ?? 200)))
    if (path === '/api/rules') return json(res, 200, { version: RULES_VERSION, rules: RULE_TABLE })

    const patientMatch = path.match(/^\/api\/patients\/([\w-]+)$/)
    if (patientMatch && method === 'GET') {
      const via = (url.searchParams.get('via') ?? 'queue') as 'queue' | 'scan' | 'search'
      const detail = this.store.detail(patientMatch[1], session.actor, via)
      if (!detail) throw new HttpError(404, 'Patient not found')
      return json(res, 200, detail)
    }

    const cardMatch = path.match(/^\/api\/cards\/([\w-]+)$/)
    if (cardMatch && method === 'GET') {
      const id = normaliseCardId(decodeURIComponent(cardMatch[1]))
      if (!isCardId(id)) throw new HttpError(400, 'That doesn’t look like a Nexa Health card ID')
      const patientId = this.store.lookupCard(id)
      if (!patientId) throw new HttpError(404, 'No patient with that card')
      return json(res, 200, { patientId })
    }

    if (path === '/api/decisions' && method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf8')) as {
        patientId: string
        action: DecisionAction
        scheduledFor?: string | null
        note?: string
      }
      if (!['continue', 'review', 'refer', 'protocol'].includes(body.action)) throw new HttpError(400, 'Unknown action')
      return json(res, 200, this.store.decide(body, session.actor))
    }

    if (path === '/api/decisions/bulk-green' && method === 'POST') {
      return json(res, 200, this.store.bulkContinueGreen(session.actor))
    }

    throw new HttpError(404, 'Not found')
  }

  private subscribe(req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.write(`retry: 1500\nevent: hello\ndata: ${JSON.stringify({ serverTime: new Date().toISOString() })}\n\n`)
    this.clients.add(res)
    this.emitStatus()
    req.on('close', () => {
      this.clients.delete(res)
      this.emitStatus()
    })
  }

  private broadcast(event: string, data: unknown): void {
    if (!this.clients.size) return
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    for (const c of this.clients) c.write(payload)
  }

  private async serveStatic(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    // One-tap pairing: /?pair=123456 sets the session cookie, then drops the code from the URL.
    const pair = url.searchParams.get('pair')
    if (pair) {
      if (this.pairCode && pair === this.pairCode) setSessionCookie(res, this.createSession().token)
      res.writeHead(302, { Location: '/' })
      return void res.end()
    }

    if (this.devUrl) return this.proxyDev(req, res, url)

    let rel = url.pathname === '/' ? '/portal.html' : url.pathname
    if (rel === '/index.html') rel = '/portal.html' // the Field UI is not served to browsers
    const file = normalize(join(this.staticRoot, rel))
    if (!file.startsWith(normalize(this.staticRoot))) throw new HttpError(403, 'Forbidden')

    let body: Buffer
    let target = file
    try {
      body = await readFile(file)
    } catch {
      if (extname(rel)) throw new HttpError(404, 'Not found')
      target = join(this.staticRoot, 'portal.html') // SPA fallback
      body = await readFile(target)
    }
    const ext = extname(target)
    res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream')
    if (ext === '.html') {
      res.setHeader('Content-Security-Policy', CSP)
      res.setHeader('Cache-Control', 'no-cache')
    } else if (rel.startsWith('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    }
    res.writeHead(200)
    res.end(req.method === 'HEAD' ? undefined : body)
  }

  /** Development only: forward non-API requests to the Vite dev server. */
  private proxyDev(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const base = new URL(this.devUrl!)
    const path = url.pathname === '/' ? '/portal.html' + url.search : url.pathname + url.search
    return new Promise((resolve) => {
      const upstream = httpRequest(
        { hostname: base.hostname, port: base.port, path, method: req.method, headers: { ...req.headers, host: base.host } },
        (up) => {
          res.writeHead(up.statusCode ?? 502, up.headers)
          up.pipe(res)
          up.on('end', resolve)
        },
      )
      upstream.on('error', () => {
        res.writeHead(502)
        res.end('Dev server not reachable')
        resolve()
      })
      req.pipe(upstream)
    })
  }

  private createSession(): Session {
    const token = randomBytes(24).toString('base64url')
    const s = { token, actor: this.store.clinic.doctor, createdAt: Date.now() }
    this.sessions.set(token, s)
    this.store.audit('pair', s.actor, 'Browser paired with the clinic portal')
    return s
  }

  private session(req: IncomingMessage): Session | null {
    const cookie = req.headers.cookie ?? ''
    const token = cookie
      .split(';')
      .map((c) => c.trim().split('='))
      .find(([k]) => k === COOKIE)?.[1]
    return token ? (this.sessions.get(token) ?? null) : null
  }

  private emitStatus(): void {
    this.emit('status', this.status())
  }
}

/* ------------------------------------------------------------------ */

export function signBody(secret: string, body: string | Buffer): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

function verify(secret: string, body: Buffer, signature: string): boolean {
  const expected = Buffer.from(signBody(secret, body), 'hex')
  const given = Buffer.from(signature, 'hex')
  return expected.length === given.length && timingSafeEqual(expected, given)
}

function setSessionCookie(res: ServerResponse, token: string): void {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`)
}

function json(res: ServerResponse, status: number, data: unknown): void {
  if (res.headersSent) return void res.end()
  const body = JSON.stringify(data)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(body)
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'Payload too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function lanAddress(): string | null {
  const nets = networkInterfaces()
  const candidates: { name: string; address: string }[] = []
  for (const [name, list] of Object.entries(nets)) {
    for (const n of list ?? []) {
      if (n.family === 'IPv4' && !n.internal && !n.address.startsWith('169.254.')) candidates.push({ name, address: n.address })
    }
  }
  const preferred = candidates.find((c) => /^(en0|en1|wi-?fi|wlan|ethernet|eth)/i.test(c.name))
  return (preferred ?? candidates[0])?.address ?? null
}
