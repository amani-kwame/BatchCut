import { ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { VideoService, type ClipParams } from '../services/videoService'

const videoService = new VideoService()

export function registerVideoHandlers(): void {
  // 检测 FFmpeg 是否可用（启动时调用）
  ipcMain.handle('video:checkFfmpeg', async () => {
    return videoService.checkFfmpeg()
  })

  // 打开 FFmpeg 安装教程（resources 目录下的 PDF，缺省回退到官方下载页）
  ipcMain.handle('video:openFfmpegGuide', async () => {
    // 未找到教程文件时，打开 FFmpeg 官方下载页
    await shell.openExternal('https://gitee.com/AutumnBreeze/batch-cut/blob/master/resources/FFmpeg安装教程.pdf')
    return { ok: true }
  })

  // 选择视频所在文件夹
  ipcMain.handle('video:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    return result.filePaths[0] ?? null
  })

  // 扫描文件夹下的所有视频
  ipcMain.handle('video:scanFolder', async (_event, folderPath: string) => {
    return videoService.scanFolder(folderPath)
  })

  // 选择输出目录
  ipcMain.handle('video:selectOutputDir', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    return result.filePaths[0] ?? null
  })

  // 剪辑（通过 video:progress 通道实时上报进度）
  ipcMain.handle('video:clip', async (event, params: ClipParams) => {
    return videoService.clip(params, (p) => {
      event.sender.send('video:progress', p)
    })
  })

  // 在资源管理器中打开文件夹
  ipcMain.handle('video:openFolder', async (_event, dirPath: string) => {
    return videoService.openFolder(dirPath)
  })
}
