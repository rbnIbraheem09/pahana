import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * A JSON document kept in memory and written to disk atomically
 * (write to .tmp, then rename) on a short debounce.
 */
export class JsonFile<T> {
  private timer: NodeJS.Timeout | null = null
  private pending: T | null = null

  constructor(
    private readonly path: string,
    private readonly delay = 400,
  ) {
    mkdirSync(dirname(path), { recursive: true })
  }

  read(): T | null {
    try {
      return JSON.parse(readFileSync(this.path, 'utf8')) as T
    } catch {
      return null
    }
  }

  save(data: T): void {
    this.pending = data
    if (this.timer) return
    this.timer = setTimeout(() => this.flush(), this.delay)
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.pending == null) return
    const tmp = `${this.path}.tmp`
    writeFileSync(tmp, JSON.stringify(this.pending))
    renameSync(tmp, this.path)
    this.pending = null
  }
}
