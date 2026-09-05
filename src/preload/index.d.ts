import { ElectronAPI } from '@electron-toolkit/preload'

interface WindowAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
}

interface ThemeAPI {
  get: () => Promise<string>
  set: (theme: 'system' | 'light' | 'dark') => Promise<boolean>
  isDark: () => Promise<boolean>
}

interface VideoFileInfo {
  path: string
  name: string
  duration: number
  width: number
  height: number
  size: number
  fps: number
}

interface VideoClipSegment {
  start: number
  end: number
  name?: string
}

interface VideoClipParams {
  inputPath: string
  segments: VideoClipSegment[]
  outputDir: string
  quality: 'original' | 'p480' | 'high' | 'medium' | 'low'
  /** 将片段名称以红色大字叠加在输出画面中央（默认开启） */
  burnText?: boolean
}

interface VideoClipProgress {
  fileName: string
  segmentIndex: number
  segmentCount: number
  localPercent: number
  overallPercent: number
  currentOutput: string
}

interface VideoClipResult {
  successCount: number
  failCount: number
  outputs: string[]
  errors: string[]
}

interface VideoAPI {
  checkFfmpeg: () => Promise<{ ffmpeg: boolean; ffprobe: boolean }>
  openExternal: (url: string) => Promise<{ ok: boolean; error?: string }>
  selectFolder: () => Promise<string | null>
  scanFolder: (folderPath: string) => Promise<VideoFileInfo[]>
  selectOutputDir: () => Promise<string | null>
  clip: (params: VideoClipParams) => Promise<VideoClipResult>
  openFolder: (dirPath: string) => Promise<string>
  onProgress: (callback: (p: VideoClipProgress) => void) => () => void
}

interface API {
  window: WindowAPI
  theme: ThemeAPI
  video: VideoAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
