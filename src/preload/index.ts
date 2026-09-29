import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { PahanaApi } from './api'

function listen<T>(channel: string) {
  return (cb: (payload: T) => void) => {
    const handler = (_e: IpcRendererEvent, payload: T) => cb(payload)
    ipcRenderer.on(channel, handler)
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
  }
}

const api: PahanaApi = {
  platform: process.platform as PahanaApi['platform'],
  field: {
    get: () => ipcRenderer.invoke('field:get'),
    onState: listen('field:state'),
    register: (input) => ipcRenderer.invoke('field:register', input),
    addReading: (input) => ipcRenderer.invoke('field:reading', input),
    setOnline: (online) => ipcRenderer.invoke('field:online', online),
    updateSettings: (patch) => ipcRenderer.invoke('field:settings', patch),
    updateProfile: (patch) => ipcRenderer.invoke('field:profile', patch),
  },
  sync: {
    get: () => ipcRenderer.invoke('sync:get'),
    now: () => ipcRenderer.invoke('sync:now'),
    onStatus: listen('sync:status'),
    onDecisions: listen('sync:decisions'),
  },
  portal: {
    get: () => ipcRenderer.invoke('portal:get'),
    start: (lan) => ipcRenderer.invoke('portal:start', lan),
    stop: () => ipcRenderer.invoke('portal:stop'),
    setLan: (lan) => ipcRenderer.invoke('portal:lan', lan),
    open: () => ipcRenderer.invoke('portal:open'),
    onStatus: listen('portal:status'),
    onRequests: listen('portal:requests'),
  },
  app: {
    info: () => ipcRenderer.invoke('app:info'),
    openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
    resetDemo: () => ipcRenderer.invoke('app:reset-demo'),
    onCommand: listen('app:command'),
  },
  win: {
    state: () => ipcRenderer.invoke('win:state'),
    onState: listen('win:state'),
  },
}

contextBridge.exposeInMainWorld('pahana', api)
