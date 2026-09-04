import { app, shell, BrowserWindow, ipcMain, nativeTheme, protocol } from 'electron'
import { join } from 'path'
import { createReadStream, statSync } from 'fs'
import { Readable } from 'stream'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null

// 常见音视频 MIME 映射（<video>/<audio> 播放与 Range 拖动进度必需）
const MIME_MAP: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/x-m4v',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv',
  '.ts': 'video/mp2t',
  '.m2ts': 'video/mp2t',
  '.mpg': 'video/mpeg',
  '.mpeg': 'video/mpeg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.flac': 'audio/flac'
}

function mimeForFile(filePath: string): string {
  const dot = filePath.lastIndexOf('.')
  const ext = dot >= 0 ? filePath.slice(dot).toLowerCase() : ''
  return MIME_MAP[ext] || 'application/octet-stream'
}

// 注册特权协议：media:// 用于渲染进程播放本地视频文件（必须在 app ready 之前注册）
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
])

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    frame: false, // 使用自定义标题栏
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.batchcut.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 注册所有 IPC 处理器
  registerAllIpcHandlers()

  // media:// 协议：将 media://local/<encodeURIComponent(绝对路径)> 映射为本地文件流
  // 手动处理 HTTP Range 请求（返回 206 分段响应），否则 <video> 无法拖动进度条 / 无法显示时长
  protocol.handle('media', (request) => {
    const url = new URL(request.url)
    const rawPath = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
    if (!rawPath) return new Response('Not Found', { status: 404 })
    try {
      const stats = statSync(rawPath)
      if (!stats.isFile()) return new Response('Not Found', { status: 404 })

      const total = stats.size
      const rangeHeader = request.headers.get('Range')
      let start = 0
      let end = total - 1
      let status = 200

      if (rangeHeader) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
        if (m && (m[1] !== '' || m[2] !== '')) {
          start = m[1] !== '' ? parseInt(m[1], 10) : 0
          end = m[2] !== '' ? Math.min(parseInt(m[2], 10), total - 1) : total - 1
          if (start > end || start >= total) {
            return new Response(null, {
              status: 416,
              headers: { 'Content-Range': `bytes */${total}` }
            })
          }
          status = 206
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': mimeForFile(rawPath),
        'Accept-Ranges': 'bytes',
        'Content-Length': String(end - start + 1),
        'Cache-Control': 'no-store'
      }
      if (status === 206) {
        headers['Content-Range'] = `bytes ${start}-${end}/${total}`
      }

      const nodeStream = createReadStream(rawPath, { start, end })
      const body = Readable.toWeb(nodeStream) as unknown as BodyInit
      return new Response(body, { status, headers })
    } catch {
      return new Response('Not Found', { status: 404 })
    }
  })

  // 窗口控制
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.on('window:close', () => mainWindow?.close())
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)

  // 主题相关
  ipcMain.handle('theme:get', () => nativeTheme.themeSource)
  ipcMain.handle('theme:set', (_event, theme: 'system' | 'light' | 'dark') => {
    nativeTheme.themeSource = theme
    return nativeTheme.shouldUseDarkColors
  })
  ipcMain.handle('theme:isDark', () => nativeTheme.shouldUseDarkColors)

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
