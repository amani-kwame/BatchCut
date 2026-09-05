import { ipcMain, dialog, shell } from 'electron'
import { VideoService, type ClipParams } from '../services/videoService'

const videoService = new VideoService()

export function registerVideoHandlers(): void {
  // 检测 FFmpeg 是否可用（启动时调用）
  ipcMain.handle('video:checkFfmpeg', async () => {
    return videoService.checkFfmpeg()
  })

  // 打开外部链接（仅允许 https，供教程弹窗等场景使用）
  ipcMain.handle('video:openExternal', async (_event, url: string) => {
    if (typeof url === 'string' && /^https:\/\//.test(url)) {
      await shell.openExternal(url)
      return { ok: true }
    }
    return { ok: false, error: 'invalid url' }
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
