import type {
  FieldSettings,
  FieldState,
  NewPatientInput,
  NewReadingInput,
  Patient,
  PortalStatus,
  Reading,
  RequestLogEntry,
  SyncLogEntry,
  SyncStatus,
} from '../shared/types'

type Unsubscribe = () => void

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

export interface PahanaApi {
  platform: 'darwin' | 'win32' | 'linux'
  field: {
    get(): Promise<FieldState>
    onState(cb: (s: FieldState) => void): Unsubscribe
    register(input: NewPatientInput): Promise<Patient>
    addReading(input: NewReadingInput): Promise<Reading>
    setOnline(online: boolean): Promise<void>
    updateSettings(patch: Partial<FieldSettings>): Promise<void>
    updateProfile(patch: { workerName?: string; workerRole?: string; division?: string }): Promise<void>
  }
  sync: {
    get(): Promise<SyncStatus>
    now(): Promise<SyncLogEntry | null>
    onStatus(cb: (s: SyncStatus) => void): Unsubscribe
    onDecisions(cb: (count: number) => void): Unsubscribe
  }
  portal: {
    get(): Promise<PortalStatus>
    start(lan?: boolean): Promise<PortalStatus>
    stop(): Promise<PortalStatus>
    setLan(lan: boolean): Promise<PortalStatus>
    open(): Promise<void>
    onStatus(cb: (s: PortalStatus) => void): Unsubscribe
    onRequests(cb: (entries: RequestLogEntry[]) => void): Unsubscribe
  }
  app: {
    info(): Promise<{ version: string; platform: string }>
    openExternal(url: string): Promise<void>
    resetDemo(): Promise<void>
    onCommand(cb: (cmd: AppCommand) => void): Unsubscribe
  }
  win: {
    state(): Promise<{ fullscreen: boolean; focused: boolean }>
    onState(cb: (s: { fullscreen: boolean; focused: boolean }) => void): Unsubscribe
  }
}

declare global {
  interface Window {
    pahana: PahanaApi
  }
}
