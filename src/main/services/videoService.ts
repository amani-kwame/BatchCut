import { spawn, execFile } from 'child_process'
import { promisify } from 'util'
import { readdirSync, existsSync, mkdirSync, statSync, writeFileSync, unlinkSync, renameSync } from 'fs'
import { join, basename, extname } from 'path'
import { tmpdir } from 'os'
import { shell } from 'electron'

const execFileAsync = promisify(execFile)

const VIDEO_EXTENSIONS = [
  '.mp4', '.mov', '.mkv', '.avi', '.webm', '.flv', '.ts', '.m4v',
  '.wmv', '.mpeg', '.mpg', '.3gp', '.ogv', '.rmvb'
]

/** 画质档位：original=原画直接流复制（不重编码）；p480=缩放至 480p 重编码；其余为原分辨率重编码 */
export type ClipQuality = 'original' | 'p480' | 'high' | 'medium' | 'low'

/** 画质 → H.264 CRF 值（越小画质越高） */
const QUALITY_CRF: Record<Exclude<ClipQuality, 'original'>, string> = {
  p480: '23',
  high: '18',
  medium: '23',
  low: '28'
}

/** 水印位置：9 宫格中的 5 个常用位置（中间 + 四角） */
export type WatermarkPosition = 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right'

/** 水印样式配置（叠加在视频画面上的片段名水印） */
export interface WatermarkStyle {
  /** 水印位置，默认 'center' */
  position?: WatermarkPosition
  /**
   * 字号档位（相对视频高度的自适应比例，传 0 表示按 h/10）：
   * - 'auto'    ：h/10（默认，自适应 1080p / 4K）
   * - 'small'   ：h/16（小字幕）
   * - 'medium'  ：h/12（中号）
   * - 'large'   ：h/10（大号，默认）
   * - 'xlarge'  ：h/8（特大）
   * - 或直接传数字（像素值，drawtext 原生 fontsize）
   */
  fontSize?: 'auto' | 'small' | 'medium' | 'large' | 'xlarge' | number
  /**
   * 文字颜色（0xRRGGBB 格式字符串），默认 '0xFF0000' 红色
   * 预设：红 /橙 /绿 /蓝 /白 /黑 /黄 /青
   */
  color?: string
}

export interface VideoFileInfo {
  path: string
  name: string
  duration: number
  width: number
  height: number
  size: number
  fps: number
}

export interface ClipSegment {
  start: number
  end: number
  name?: string
}

export interface ClipParams {
  inputPath: string
  segments: ClipSegment[]
  outputDir: string
  quality: ClipQuality
  /** 将片段名称以水印样式叠加在输出画面（默认开启；original 画质会自动降级为重编码） */
  burnText?: boolean
  /** 水印样式（字号/颜色/位置），缺省时使用旧默认：居中、红色、h/10 大字 */
  watermarkStyle?: WatermarkStyle
}

export interface ClipProgress {
  fileName: string
  segmentIndex: number
  segmentCount: number
  /** 当前片段的进度 0-100 */
  localPercent: number
  /** 整个任务（多文件时由渲染层叠加）整体进度 0-100 */
  overallPercent: number
  currentOutput: string
}

export interface ClipResult {
  successCount: number
  failCount: number
  outputs: string[]
  errors: string[]
}

/** runFFmpeg 执行结果：ok=false 时 error 携带 ffmpeg stderr 末尾摘要 */
interface FFmpegRunResult {
  ok: boolean
  error?: string
}

export class VideoService {
  private ffmpegBin: string | null = null
  private ffprobeBin: string | null = null
  private fontPathCache: string | null | undefined

  /**
   * 解析可用的中文字体路径（用于 drawtext 渲染中文）。
   * 找不到时返回 null（此时跳过文字叠加，不阻断剪辑流程）。
   */
  private resolveFontPath(): string | null {
    if (this.fontPathCache !== undefined) return this.fontPathCache

    const candidates: string[] = []
    if (process.platform === 'win32') {
      const fontsDir = join(process.env.WINDIR || 'C:\\Windows', 'Fonts')
      for (const f of ['msyh.ttc', 'msyhbd.ttc', 'simhei.ttf', 'simsun.ttc']) {
        candidates.push(join(fontsDir, f))
      }
    } else {
      candidates.push(
        '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
        '/System/Library/Fonts/PingFang.ttc',
        '/System/Library/Fonts/STHeiti Light.ttc'
      )
    }

    for (const c of candidates) {
      if (existsSync(c)) {
        this.fontPathCache = c
        return c
      }
    }
    this.fontPathCache = null
    return null
  }

  /**
   * 转义 filtergraph 中的文件路径（fontfile / textfile）：
   * 反斜杠换正斜杠，盘符冒号转义为 \:
   */
  private escapeFilterPath(p: string): string {
    return p.replace(/\\/g, '/').replace(/:/g, '\\:')
  }

  /**
   * 转义 textfile 文件内容中的特殊字符。
   * 实测（ffmpeg 7.0.1）：% 必须写成 \%（%% 无效仍报 Stray %），
   * 其余常见特殊字符（' : , ; \ [ ]）原样写入即可正确渲染。
   */
  private escapeTextContent(text: string): string {
    return text.replace(/%/g, '\\%')
  }

  /**
   * 构建 drawtext 滤镜字符串。
   * 字号默认按视频高度自适应（h/10），可由 watermarkStyle.fontSize 覆盖（档位或像素值）。
   * 位置由 watermarkStyle.position 决定（默认居中），颜色由 watermarkStyle.color 决定（默认红色）。
   *
   * 时间控制：本工程重编码路径采用「输出端 seek」（-ss 在 -i 之后），
   * 此时 drawtext 的 t 基于【源视频原始时间轴】而非片段内时间。
   * 因此用 between(t, segStart, segStart+2) 按源时间轴圈定「片段开头 2 秒」，
   * 并在两端各留 0.1s 余量，规避关键帧对齐造成的起止偏差（setpts 对此无效）。
   *
   * @param persist 为 true 时生成「静态封面」用滤镜：文字常驻不消失（不带 enable）。
   */
  private buildDrawtextFilter(
    textFile: string,
    segStart: number,
    style?: WatermarkStyle,
    persist = false
  ): string | null {
    const font = this.resolveFontPath()
    if (!font) {
      console.warn('[videoService] 未找到中文字体，跳过文字叠加')
      return null
    }
    const position = style?.position ?? 'center'
    const color = style?.color ?? '0xFF0000'
    const fontSizeExpr = this.resolveFontSizeExpr(style?.fontSize)

    // 距边缘 20 像素（相对像素位置，写死数值），居中则取对称坐标
    const margin = 20
    const xyExpr = this.resolvePositionExpr(position, margin)

    const parts = [
      `drawtext=fontfile='${this.escapeFilterPath(font)}'`,
      `:textfile='${this.escapeFilterPath(textFile)}'`,
      `:fontcolor=${color}:fontsize=${fontSizeExpr}`,
      `:x=${xyExpr.x}:y=${xyExpr.y}`,
      `:box=1:boxcolor=black@0.6:boxborderw=10`,
      `:borderw=3:bordercolor=white@0.9`,
      `:shadowx=3:shadowy=3:shadowcolor=black@0.5:alpha=0.85`
    ]
    if (!persist) {
      const from = (segStart - 0.1).toFixed(3)
      const to = (segStart + 2.1).toFixed(3)
      parts.push(`:enable='between(t,${from},${to})'`)
    }
    return parts.join('')
  }

  /**
   * 解析字号表达式：
   * - 'auto' / undefined → 'h/10'（默认，与旧行为兼容）
   * - 'small'  → 'h/16'
   * - 'medium' → 'h/12'
   * - 'large'  → 'h/10'
   * - 'xlarge' → 'h/8'
   * - 数字（>0） → 原样作为像素值
   */
  private resolveFontSizeExpr(s: WatermarkStyle['fontSize']): string {
    if (s === undefined || s === 'auto' || s === 'large') return 'h/10'
    if (s === 'small') return 'h/16'
    if (s === 'medium') return 'h/12'
    if (s === 'xlarge') return 'h/8'
    if (typeof s === 'number' && s > 0) return String(Math.round(s))
    return 'h/10'
  }

  /**
   * 解析水印位置 → drawtext 的 x/y 表达式（基于 w/h 变量）。
   * 居中取对称坐标；四角按 20 像素内边距对齐。
   */
  private resolvePositionExpr(
    pos: WatermarkPosition,
    margin: number
  ): { x: string; y: string } {
    switch (pos) {
      case 'top-left':
        return { x: String(margin), y: String(margin) }
      case 'top-right':
        return { x: `w-text_w-${margin}`, y: String(margin) }
      case 'bottom-left':
        return { x: String(margin), y: `h-text_h-${margin}` }
      case 'bottom-right':
        return { x: `w-text_w-${margin}`, y: `h-text_h-${margin}` }
      case 'center':
      default:
        return { x: '(w-text_w)/2', y: '(h-text_h)/2' }
    }
  }

  /**
   * 检测 ffmpeg / ffprobe 是否可用（不抛异常，供启动时提示用户）。
   * 返回两个二进制各自的可用状态。
   */
  checkFfmpeg(): { ffmpeg: boolean; ffprobe: boolean } {
    return {
      ffmpeg: this.tryResolveBinary('ffmpeg') !== null,
      ffprobe: this.tryResolveBinary('ffprobe') !== null
    }
  }

  /** 静默查找二进制（找到返回路径，找不到返回 null，不抛异常） */
  private tryResolveBinary(name: 'ffmpeg' | 'ffprobe'): string | null {
    try {
      return this.resolveBinary(name)
    } catch {
      return null
    }
  }

  private resolveBinary(name: 'ffmpeg' | 'ffprobe'): string {
    const cached = name === 'ffmpeg' ? this.ffmpegBin : this.ffprobeBin
    if (cached && existsSync(cached)) return cached

    const candidates: string[] = []

    // 1. 环境变量（如 FFMPEG_PATH / FFPROBE_PATH）
    const envKey = name.toUpperCase() + '_PATH'
    const envPath = process.env[envKey]
    if (envPath) candidates.push(envPath)

    // 2. PATH
    const pathDirs = (process.env.PATH || '').split(';').filter(Boolean)
    for (const dir of pathDirs) {
      candidates.push(join(dir, name + '.exe'), join(dir, name))
    }

    // 3. 常见安装目录（Windows / mac / Linux）
    const parents = [
      'D:\\tools',
      'C:\\',
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      '/usr/bin',
      '/usr/local/bin',
      '/opt/homebrew/bin'
    ]
    for (const parent of parents) {
      if (!existsSync(parent)) continue
      try {
        const entries = readdirSync(parent)
        for (const entry of entries) {
          if (entry.toLowerCase().startsWith('ffmpeg')) {
            candidates.push(join(parent, entry, 'bin', name + '.exe'))
          }
        }
      } catch {
        /* 忽略无权限目录 */
      }
      candidates.push(join(parent, name + '.exe'), join(parent, name))
    }

    for (const candidate of candidates) {
      if (candidate && existsSync(candidate)) {
        if (name === 'ffmpeg') this.ffmpegBin = candidate
        else this.ffprobeBin = candidate
        return candidate
      }
    }

    throw new Error(
      `未找到 ${name}，请下载二进制版FFmpeg压缩包（https://github.com/BtbN/FFmpeg-Builds/releases）并解压到D:\\tools\\目录下`
    )
  }

  /** 扫描文件夹（仅当前层级）下的所有视频文件，并探测元数据 */
  async scanFolder(folderPath: string): Promise<VideoFileInfo[]> {
    let entries: string[]
    try {
      entries = readdirSync(folderPath)
    } catch (e) {
      throw new Error('无法读取文件夹：' + (e as Error).message)
    }

    const videos = entries
      .filter((n) => VIDEO_EXTENSIONS.includes(extname(n).toLowerCase()))
      .map((n) => join(folderPath, n))

    const infos: VideoFileInfo[] = []
    const queue = [...videos]
    const workers = Array.from({ length: Math.min(4, queue.length || 1) }, async () => {
      while (queue.length) {
        const p = queue.shift()!
        const info = await this.probe(p)
        if (info) infos.push(info)
      }
    })
    await Promise.all(workers)

    infos.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    return infos
  }

  /** 用 ffprobe 获取单个视频的时长 / 分辨率 / 帧率等信息 */
  private async probe(filePath: string): Promise<VideoFileInfo | null> {
    let size = 0
    try {
      size = statSync(filePath).size
    } catch {
      /* 忽略 */
    }
    try {
      const ffprobe = this.resolveBinary('ffprobe')
      const { stdout } = await execFileAsync(
        ffprobe,
        [
          '-v', 'error',
          '-select_streams', 'v:0',
          '-show_entries', 'stream=width,height,avg_frame_rate,duration',
          '-show_entries', 'format=duration',
          '-of', 'json',
          filePath
        ],
        { windowsHide: true, maxBuffer: 16 * 1024 * 1024 }
      )
      const data = JSON.parse(stdout)
      const stream = data.streams?.[0] ?? {}
      const format = data.format ?? {}
      const duration = Number.parseFloat(stream.duration ?? format.duration) || 0
      return {
        path: filePath,
        name: basename(filePath),
        duration,
        width: Number(stream.width) || 0,
        height: Number(stream.height) || 0,
        size,
        fps: this.parseFps(stream.avg_frame_rate)
      }
    } catch {
      // 探测失败时仍返回基础信息，便于展示列表
      return { path: filePath, name: basename(filePath), duration: 0, width: 0, height: 0, size, fps: 0 }
    }
  }

  private parseFps(rate: string | undefined): number {
    if (!rate) return 0
    const [num, den] = rate.split('/').map(Number)
    if (!num || !den) return 0
    return Math.round((num / den) * 100) / 100
  }

  /**
   * 按片段剪辑视频（多片段依次输出，精确切割采用输出端 seek + 重编码）
   * 每个片段输出为 {原文件名}_{片段名}.mp4
   */
  async clip(params: ClipParams, onProgress?: (p: ClipProgress) => void): Promise<ClipResult> {
    const ffmpeg = this.resolveBinary('ffmpeg')
    if (!params.segments.length) {
      throw new Error('没有可剪辑的片段，请先标记起点和终点')
    }
    mkdirSync(params.outputDir, { recursive: true })

    const base = basename(params.inputPath, extname(params.inputPath))
    const outputs: string[] = []
    const errors: string[] = []
    let successCount = 0
    const segmentCount = params.segments.length

    for (let i = 0; i < segmentCount; i++) {
      const seg = params.segments[i]
      const duration = seg.end - seg.start
      if (!isFinite(duration) || duration <= 0) {
        errors.push(`${base} 片段 ${i + 1}：时间范围无效（${seg.start} ~ ${seg.end}）`)
        continue
      }
      const segName = (seg.name && seg.name.trim()) || `片段${i + 1}`
      const outputPath = join(params.outputDir, `${base}_${segName}.mp4`)

      // 文字叠加：把片段名称写入临时文本文件（textfile 方式可正确转义 % 等特殊字符）
      const burnText = params.burnText !== false
      let textFile: string | undefined
      if (burnText && this.resolveFontPath()) {
        textFile = join(tmpdir(), `vtext_${process.pid}_${Date.now()}_${i}.txt`)
        try {
          writeFileSync(textFile, this.escapeTextContent(segName), 'utf8')
        } catch {
          textFile = undefined
        }
      }

      try {
        // 原画 + 无文字叠加时走流复制快速路径；失败（部分视频时间戳异常导致 muxer 报错）自动降级重编码重试
        const usedStreamCopy = params.quality === 'original' && !textFile
        let args = this.buildClipArgs(params, seg, duration, outputPath, textFile)

        const totalMs = duration * 1000
        const progressCb = (outTimeMs: number): void => {
          const localPercent = Math.min(100, Math.round((outTimeMs / totalMs) * 100))
          onProgress?.({
            fileName: base,
            segmentIndex: i,
            segmentCount,
            localPercent,
            overallPercent: Math.round(((i + localPercent / 100) / segmentCount) * 100),
            currentOutput: outputPath
          })
        }

        let res = await this.runFFmpeg(ffmpeg, args, progressCb)
        if (!res.ok && usedStreamCopy) {
          console.warn(`[videoService] 流复制剪辑失败，降级为重编码重试：${outputPath}，原因：${res.error ?? '未知'}`)
          args = this.buildClipArgs(params, seg, duration, outputPath, textFile, true)
          res = await this.runFFmpeg(ffmpeg, args, progressCb)
        }

        if (res.ok) {
          outputs.push(outputPath)
          successCount++
        } else {
          errors.push(`${base}_${segName}：ffmpeg 执行失败${res.error ? `（${res.error}）` : ''}`)
        }

        // 生成带文字的封面图（写入系统临时目录，静态、文字常驻），
        // 仅作为中间产物，以 attached_pic 方式嵌入输出 mp4，供 VLC / 部分播放器与平台显示为封面海报；
        // 封面图在嵌入后即从临时目录删除，不会保留在输出文件夹。
        // （Windows 资源管理器缩略图仍按自身规则抽帧，不受影响）
        if (textFile) {
          const coverFilter = this.buildDrawtextFilter(textFile, seg.start, params.watermarkStyle, true)
          if (coverFilter) {
            const coverPath = join(tmpdir(), `vcover_${process.pid}_${Date.now()}_${i}.png`)
            const coverArgs = [
              '-y', '-hide_banner',
              '-ss', String(seg.start),
              '-i', params.inputPath,
              '-frames:v', '1',
              '-map', '0:v:0',
              '-vf', coverFilter,
              '-update', '1',
              coverPath
            ]
            const okCover = (await this.runFFmpeg(ffmpeg, coverArgs, () => {})).ok

            // 视频剪辑成功时，把封面以 attached_pic 方式嵌入输出 mp4：
            // 先写临时文件再 rename 覆盖，避免「同一文件同时读写」的竞态。
            if (okCover && res.ok) {
              const attachTmp = join(params.outputDir, `${base}_${i}.attached.tmp.mp4`)
              const attachArgs = [
                '-y', '-hide_banner',
                '-i', outputPath,
                '-i', coverPath,
                '-map', '0', '-map', '1',
                '-c', 'copy',
                '-c:v:1', 'mjpeg',
                '-disposition:v:1', 'attached_pic',
                '-movflags', '+faststart',
                attachTmp
              ]
              const okAttach = (await this.runFFmpeg(ffmpeg, attachArgs, () => {})).ok
              if (okAttach) {
                try {
                  renameSync(attachTmp, outputPath)
                } catch {
                  // 覆盖失败则保留未嵌封面的版本，不阻断流程
                  try { unlinkSync(attachTmp) } catch { /* 忽略 */ }
                }
              } else {
                try { unlinkSync(attachTmp) } catch { /* 忽略 */ }
              }
            }

            // 封面仅作临时中间产物，无论嵌入成功与否都清理，避免输出目录留下 .png
            try { unlinkSync(coverPath) } catch { /* 忽略 */ }
          }
        }
      } finally {
        if (textFile) {
          try {
            unlinkSync(textFile)
          } catch {
            /* 临时文件清理失败可忽略 */
          }
        }
      }
    }

    return { successCount, failCount: errors.length, outputs, errors }
  }

  /**
   * 根据画质档位构建 ffmpeg 剪辑参数
   * - original：流复制（-c copy），不重编码、速度极快、画质与源一致；
   *   采用输入端 seek（-ss 在 -i 之前），起点自动对齐最近关键帧（可能有零点几秒偏差）
   *   ⚠️ 需叠加文字时无法使用流复制（滤镜必须重编码），自动降级为 CRF 18 原分辨率重编码
   * - p480：重编码并缩放至高度 480（宽度按比例、保持偶数；源低于 480p 不放大）
   * - 其余：输出端 seek（精确到帧）+ 原分辨率重编码
   *
   * @param forceReencode 为 true 时跳过 original 流复制快速路径（用于流复制失败后的自动降级重试）
   */
  private buildClipArgs(
    params: ClipParams,
    seg: ClipSegment,
    duration: number,
    outputPath: string,
    textFile?: string,
    forceReencode = false
  ): string[] {
    // 无文字叠加时维持原有 original 流复制快速路径
    if (params.quality === 'original' && !textFile && !forceReencode) {
      return [
        '-y', '-hide_banner',
        '-ss', String(seg.start),
        '-t', String(duration),
        '-i', params.inputPath,
        '-map', '0:v:0',
        '-map', '0:a:0?',
        '-c', 'copy',
        // 输入端 seek + 流复制易产生负时间戳，重整为从 0 开始，规避 muxer 报错
        '-avoid_negative_ts', 'make_zero',
        '-movflags', '+faststart',
        '-progress', 'pipe:1',
        '-nostats',
        outputPath
      ]
    }

    const drawtext = textFile ? this.buildDrawtextFilter(textFile, seg.start, params.watermarkStyle) : null

    // original + 文字叠加：降级为 CRF 18 重编码（保持原分辨率，画质几乎无损）
    const crf =
      params.quality === 'original'
        ? '18'
        : (QUALITY_CRF[params.quality as Exclude<ClipQuality, 'original'>] ?? '23')
    const args = [
      '-y', '-hide_banner',
      '-i', params.inputPath,
      '-ss', String(seg.start),
      '-t', String(duration),
      '-map', '0:v:0',
      '-map', '0:a:0?',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', crf
    ]

    if (params.quality === 'p480') {
      // scale=-2:min(ih\,480)：高度缩放到 480（不足 480 不放大），宽度 -2 按比例并强制偶数
      // 逗号需转义，否则会被 ffmpeg filtergraph 当作滤镜分隔符
      const scale = 'scale=-2:min(ih\\,480)'
      // 先缩放再叠加，文字大小按缩放后的画面计算
      args.push('-vf', drawtext ? `${scale},${drawtext}` : scale)
      args.push('-c:a', 'aac', '-b:a', '128k')
    } else {
      if (drawtext) args.push('-vf', drawtext)
      args.push('-c:a', 'aac', '-b:a', '192k')
    }

    args.push('-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', outputPath)
    return args
  }

  /** 执行 ffmpeg 并通过 -progress pipe:1 解析进度（out_time_ms 单位：微秒） */
  private runFFmpeg(
    bin: string,
    args: string[],
    onProgress: (outTimeMs: number) => void
  ): Promise<FFmpegRunResult> {
    return new Promise((resolve) => {
      const child = spawn(bin, args, { windowsHide: true })
      let buf = ''
      let stderr = ''

      child.stdout.on('data', (chunk: Buffer) => {
        buf += chunk.toString()
        let idx: number
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx).trim()
          buf = buf.slice(idx + 1)
          if (line.startsWith('out_time_ms=')) {
            const ms = Number.parseInt(line.split('=')[1], 10)
            if (!Number.isNaN(ms)) onProgress(ms / 1000)
          }
        }
      })

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })

      child.on('error', (err) => {
        resolve({ ok: false, error: `无法启动 ffmpeg：${err.message}` })
      })

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ ok: true })
        } else {
          // 取 stderr 末尾几行作为失败原因（去掉空行，截断避免过长）
          const tail = stderr
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .slice(-2)
            .join(' | ')
            .slice(0, 200)
          console.error('[videoService] ffmpeg failed:', tail || `exit code ${code}`)
          resolve({ ok: false, error: tail || `exit code ${code}` })
        }
      })
    })
  }

  /** 在系统资源管理器中打开文件夹；返回空字符串表示成功 */
  async openFolder(dirPath: string): Promise<string> {
    return shell.openPath(dirPath)
  }
}
