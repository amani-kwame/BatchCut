import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 渲染进程可用的 API
const api = {
  // 窗口控制
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized')
  },

  // 主题
  theme: {
    get: () => ipcRenderer.invoke('theme:get'),
    set: (theme: 'system' | 'light' | 'dark') => ipcRenderer.invoke('theme:set', theme),
    isDark: () => ipcRenderer.invoke('theme:isDark')
  },

  // 视频处理
  video: {
    checkFfmpeg: () => ipcRenderer.invoke('video:checkFfmpeg'),
    openFfmpegGuide: () => ipcRenderer.invoke('video:openFfmpegGuide'),
    selectFolder: () => ipcRenderer.invoke('video:selectFolder'),
    scanFolder: (folderPath: string) => ipcRenderer.invoke('video:scanFolder', folderPath),
    selectOutputDir: () => ipcRenderer.invoke('video:selectOutputDir'),
    clip: (params: unknown) => ipcRenderer.invoke('video:clip', params),
    openFolder: (dirPath: string) => ipcRenderer.invoke('video:openFolder', dirPath),
    onProgress: (callback: (p: unknown) => void) => {
      const listener = (_event: unknown, p: unknown): void => callback(p)
      ipcRenderer.on('video:progress', listener)
      return () => {
        ipcRenderer.removeListener('video:progress', listener)
      }
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
