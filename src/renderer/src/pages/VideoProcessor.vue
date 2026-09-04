<script lang="ts">
// 模块级状态：路由切换离开本页面时组件销毁，但这些数据保留，
// 再次进入视频处理模块时视频列表 / 标记片段 / 剪辑设置不会丢失。
import { ref } from 'vue'

interface Mark {
  id: number
  start: number
  end: number
  name: string
}

interface VideoRow {
  path: string
  name: string
  duration: number
  width: number
  height: number
  size: number
  fps: number
  marks: Mark[]
}

// ---------- 跨路由保留的数据 ----------
const folderPath = ref('')
const videos = ref<VideoRow[]>([])
const selectedRowKeys = ref<Array<string | number>>([])
const clipQuality = ref<'original' | 'p480' | 'high' | 'medium' | 'low'>('p480')
const clipOutputDir = ref('')
/** 将片段名称以水印样式叠加在画面（默认开启） */
const clipBurnText = ref(true)
/** 水印位置：5 个常用位置（默认居中） */
const clipWatermarkPosition = ref<'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right'>('center')
/** 水印字号：'small' / 'medium' / 'large'(默认 h/10) / 'xlarge' / number(像素) */
const clipWatermarkFontSize = ref<'small' | 'medium' | 'large' | 'xlarge' | number>('large')
/** 水印颜色：0xRRGGBB 字符串（默认红色） */
const clipWatermarkColor = ref('0xFF0000')
</script>

<script setup lang="ts">
import { computed, h, watch, onBeforeUnmount } from 'vue'
import {
  NCard, NButton, NSpace, NTag, NDataTable, NModal, NInputNumber,
  NSelect, NProgress, NInput, NAlert, NEmpty, NSwitch, NPopconfirm, useMessage
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'

const message = useMessage()

// ---------- 文件夹与视频列表 ----------
const scanning = ref(false)

const qualityOptions = [
  { label: '原画（无损，速度最快，起点对齐关键帧）', value: 'original' },
  { label: '480p（缩放至 480p，体积小）', value: 'p480' },
  { label: '高清（H.264 CRF 18）', value: 'high' },
  { label: '标准（H.264 CRF 23）', value: 'medium' },
  { label: '流畅（H.264 CRF 28）', value: 'low' }
]

/** 水印位置 5 档（左上 / 右上 / 居中 / 左下 / 右下） */
const watermarkPositionOptions = [
  { label: '左上', value: 'top-left' },
  { label: '右上', value: 'top-right' },
  { label: '居中', value: 'center' },
  { label: '左下', value: 'bottom-left' },
  { label: '右下', value: 'bottom-right' }
]

/** 水印字号 4 档（small / medium / large 默认 / xlarge） */
const watermarkFontSizeOptions = [
  { label: '小 (h/16)', value: 'small' },
  { label: '中 (h/12)', value: 'medium' },
  { label: '大 (h/10)', value: 'large' },
  { label: '特大 (h/8)', value: 'xlarge' }
]

/** 水印颜色 8 色预设 */
const watermarkColorOptions = [
  { label: '🔴 红色', value: '0xFF0000' },
  { label: '🟠 橙色', value: '0xFF8C00' },
  { label: '🟡 黄色', value: '0xFFFF00' },
  { label: '🟢 绿色', value: '0x00C853' },
  { label: '🔵 蓝色', value: '0x2196F3' },
  { label: '🟣 紫色', value: '0x9C27B0' },
  { label: '⚪ 白色', value: '0xFFFFFF' },
  { label: '⚫ 黑色', value: '0x000000' }
]

/** 手动清空：视频列表、标记片段、勾选状态（剪辑设置保留） */
function clearAll(): void {
  folderPath.value = ''
  videos.value = []
  selectedRowKeys.value = []
  message.success('已清空视频列表与标记数据')
}

async function selectFolder(): Promise<void> {
  const dir = await window.api.video.selectFolder()
  if (!dir) return
  folderPath.value = dir
  await scanFolder()
}

async function scanFolder(): Promise<void> {
  if (!folderPath.value) return
  scanning.value = true
  selectedRowKeys.value = []
  try {
    const list = await window.api.video.scanFolder(folderPath.value)
    videos.value = list.map((v) => ({ ...v, marks: [] as Mark[] }))
    if (list.length) message.success(`扫描到 ${list.length} 个视频`)
    else message.info('该文件夹下没有视频文件')
  } catch (e) {
    message.error('扫描失败：' + (e as Error).message)
  } finally {
    scanning.value = false
  }
}

// ---------- 播放与标记 ----------
const playerOpen = ref(false)
const currentVideo = ref<VideoRow | null>(null)
const videoEl = ref<HTMLVideoElement | null>(null)
const currentTime = ref(0)
const pendingStart = ref<number | null>(null)
const playerMarks = ref<Mark[]>([])
let markSeq = 1

/** 本地文件路径 → media:// 可播放 URL */
function toMediaUrl(filePath: string): string {
  return 'media://local/' + encodeURIComponent(filePath)
}

function openPlayer(row: VideoRow): void {
  currentVideo.value = row
  playerMarks.value = row.marks.map((m) => ({ ...m }))
  pendingStart.value = null
  currentTime.value = 0
  markSeq = Date.now() % 100000
  playerOpen.value = true
}

function onPlayerClose(): void {
  const el = videoEl.value
  if (el) {
    el.pause()
    el.removeAttribute('src')
    el.load()
  }
  currentVideo.value = null
  playerMarks.value = []
  pendingStart.value = null
}

function onTimeUpdate(): void {
  const el = videoEl.value
  if (el) currentTime.value = el.currentTime
}

function markStart(): void {
  const el = videoEl.value
  if (!el) return
  pendingStart.value = el.currentTime
  message.info(`已标记起点：${formatTime(el.currentTime)}`)
}

function markEnd(): void {
  const el = videoEl.value
  if (!el) return
  const start = pendingStart.value
  const end = el.currentTime
  if (start == null) {
    message.warning('请先点击「标记起点」')
    return
  }
  if (end <= start) {
    message.warning('结束时间必须大于开始时间，请先拖动进度条或继续播放')
    return
  }
  playerMarks.value.push({
    id: markSeq++,
    start: Math.round(start * 100) / 100,
    end: Math.round(end * 100) / 100,
    name: `片段${playerMarks.value.length + 1}`
  })
  pendingStart.value = null
  message.success(`已添加片段：${formatTime(start)} ~ ${formatTime(end)}`)
}

function removeMark(id: number): void {
  playerMarks.value = playerMarks.value.filter((m) => m.id !== id)
}

function saveMarks(): void {
  const invalid = playerMarks.value.find((m) => !(m.end > m.start))
  if (invalid) {
    message.warning('存在无效片段（结束时间必须大于开始时间）')
    return
  }
  if (currentVideo.value) {
    currentVideo.value.marks = playerMarks.value.map((m) => ({ ...m }))
  }
  playerOpen.value = false
  message.success(`已保存 ${playerMarks.value.length} 个标记片段`)
}

// 快捷键：播放弹窗内按 [ 标记起点、] 标记终点
function onKeydown(e: KeyboardEvent): void {
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
  if (e.key === '[') {
    e.preventDefault()
    markStart()
  } else if (e.key === ']') {
    e.preventDefault()
    markEnd()
  }
}

watch(playerOpen, (open) => {
  if (open) window.addEventListener('keydown', onKeydown)
  else window.removeEventListener('keydown', onKeydown)
})

// ---------- 剪辑配置（clipQuality / clipOutputDir / clipBurnText 为模块级状态，跨路由保留） ----------
const clipModalOpen = ref(false)
const clipMode = ref<'single' | 'batch'>('single')
const clipTargets = ref<VideoRow[]>([])

function clipSingle(row: VideoRow): void {
  if (!row.marks.length) {
    message.warning('该视频还没有标记片段，请先点击「播放/标记」添加')
    return
  }
  clipMode.value = 'single'
  clipTargets.value = [row]
  clipModalOpen.value = true
}

function clipBatch(): void {
  const targets = videos.value.filter((v) => selectedRowKeys.value.includes(v.path) && v.marks.length)
  if (!targets.length) {
    message.warning('请先勾选至少一个「已标记片段」的视频')
    return
  }
  clipMode.value = 'batch'
  clipTargets.value = targets
  clipModalOpen.value = true
}

const selectedVideos = computed(() => videos.value.filter((v) => selectedRowKeys.value.includes(v.path)))
const selectedMarkCount = computed(() => selectedVideos.value.reduce((s, v) => s + v.marks.length, 0))

const clipSummary = computed(() => {
  const segCount = clipTargets.value.reduce((s, v) => s + v.marks.length, 0)
  if (clipMode.value === 'single') return `${clipTargets.value.length} 个视频 · ${segCount} 个片段`
  return `${clipTargets.value.length} 个视频 · 共 ${segCount} 个片段（未标记的视频自动跳过）`
})

async function selectOutputDir(): Promise<void> {
  const dir = await window.api.video.selectOutputDir()
  if (dir) clipOutputDir.value = dir
}

// ---------- 剪辑执行与进度 ----------
const progressOpen = ref(false)
const processing = ref(false)
const overallPercent = ref(0)
const localPercent = ref(0)
const progressText = ref('')
const currentFileIndex = ref(0)
const totalFiles = ref(0)
const resultState = ref<{ successCount: number; failCount: number; outputs: string[]; errors: string[] } | null>(null)

let progressOff: (() => void) | null = null

function registerProgress(total: number): void {
  progressOff = window.api.video.onProgress((p) => {
    localPercent.value = p.localPercent
    progressText.value = `正在剪辑：${p.fileName} · 片段 ${p.segmentIndex + 1}/${p.segmentCount}`
    overallPercent.value = Math.round(
      ((currentFileIndex.value + p.localPercent / 100) / total) * 100
    )
  })
}

async function startClip(): Promise<void> {
  if (!clipTargets.value.length) return
  if (!clipOutputDir.value) {
    message.warning('请选择输出目录')
    return
  }
  clipModalOpen.value = false
  progressOpen.value = true
  processing.value = true
  resultState.value = null
  overallPercent.value = 0
  localPercent.value = 0
  currentFileIndex.value = 0
  totalFiles.value = clipTargets.value.length

  registerProgress(totalFiles.value)

  const outputs: string[] = []
  const errors: string[] = []
  let successCount = 0
  let failCount = 0

  try {
    for (let i = 0; i < clipTargets.value.length; i++) {
      const v = clipTargets.value[i]
      currentFileIndex.value = i
      try {
        const res = await window.api.video.clip({
          inputPath: v.path,
          segments: v.marks.map((m) => ({ start: m.start, end: m.end, name: m.name })),
          outputDir: clipOutputDir.value,
          quality: clipQuality.value,
          burnText: clipBurnText.value,
          watermarkStyle: clipBurnText.value
            ? {
                position: clipWatermarkPosition.value,
                fontSize: clipWatermarkFontSize.value,
                color: clipWatermarkColor.value
              }
            : undefined
        })
        successCount += res.successCount
        failCount += res.failCount
        outputs.push(...res.outputs)
        errors.push(...res.errors)
      } catch (e) {
        failCount += v.marks.length
        errors.push(`${v.name}：${(e as Error).message}`)
      }
    }
    overallPercent.value = 100
    resultState.value = { successCount, failCount, outputs, errors }
  } finally {
    processing.value = false
    progressOff?.()
    progressOff = null
  }
}

async function openOutputDir(): Promise<void> {
  const err = await window.api.video.openFolder(clipOutputDir.value)
  if (err) message.error('打开文件夹失败：' + err)
}

onBeforeUnmount(() => {
  progressOff?.()
  window.removeEventListener('keydown', onKeydown)
})

// ---------- 格式化 ----------
function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '00:00.00'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const cs = Math.round((sec - Math.floor(sec)) * 100)
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  const cc = String(cs).padStart(2, '0')
  return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}.${cc}` : `${mm}:${ss}.${cc}`
}

function formatDuration(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return '--:--'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function formatSize(bytes: number): string {
  if (!bytes) return '--'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

// ---------- 表格列 ----------
const columns: DataTableColumns<VideoRow> = [
  { type: 'selection', width: 40 },
  {
    title: '文件名',
    key: 'name',
    minWidth: 220,
    ellipsis: { tooltip: true }
  },
  {
    title: '时长',
    key: 'duration',
    width: 90,
    render: (row) => formatDuration(row.duration)
  },
  {
    title: '分辨率',
    key: 'resolution',
    width: 100,
    render: (row) => (row.width && row.height ? `${row.width}×${row.height}` : '--')
  },
  {
    title: '大小',
    key: 'size',
    width: 90,
    render: (row) => formatSize(row.size)
  },
  {
    title: '标记片段',
    key: 'marks',
    width: 100,
    render: (row) =>
      row.marks.length
        ? h(NTag, { type: 'success', size: 'small' }, { default: () => `${row.marks.length} 段` })
        : h(NTag, { type: 'default', size: 'small' }, { default: () => '未标记' })
  },
  {
    title: '操作',
    key: 'actions',
    width: 190,
    fixed: 'right',
    render: (row) =>
      h(NSpace, { size: 8 }, {
        default: () => [
          h(
            NButton,
            { size: 'small', onClick: () => openPlayer(row) },
            { default: () => '播放/标记' }
          ),
          h(
            NButton,
            { size: 'small', type: 'primary', secondary: true, onClick: () => clipSingle(row) },
            { default: () => '剪辑' }
          )
        ]
      })
  }
]
</script>

<template>
  <div>
    <!-- 文件夹选择 -->
    <NCard :bordered="false" style="margin-bottom: 16px;">
      <NSpace align="center" wrap>
        <NButton type="primary" :loading="scanning" @click="selectFolder">选择文件夹</NButton>
        <NButton v-if="folderPath" :loading="scanning" @click="scanFolder">重新扫描</NButton>
        <NPopconfirm
          v-if="folderPath || videos.length"
          @positive-click="clearAll"
        >
          <template #trigger>
            <NButton type="error" secondary>清空</NButton>
          </template>
          确认清空当前视频列表与所有标记片段？此操作不可撤销。
        </NPopconfirm>
        <NTag v-if="folderPath" type="info" style="max-width: 480px;">{{ folderPath }}</NTag>
        <NTag v-if="videos.length" type="success">共 {{ videos.length }} 个视频</NTag>
      </NSpace>
    </NCard>

    <!-- 视频表格 + 批量剪辑 -->
    <NCard :bordered="false" title="视频列表">
      <NDataTable
        v-if="videos.length"
        :columns="columns"
        :data="videos"
        :row-key="(row: VideoRow) => row.path"
        v-model:checked-row-keys="selectedRowKeys"
        :scroll-x="820"
        :max-height="420"
        :loading="scanning"
      />
      <NEmpty v-else description="请先选择包含视频的文件夹" style="padding: 40px 0;" />
      <template #footer>
        <NSpace align="center" wrap style="margin-top: 4px;">
          <NTag v-if="selectedVideos.length" type="warning">
            已选 {{ selectedVideos.length }} 个视频 / {{ selectedMarkCount }} 段标记
          </NTag>
          <NButton
            type="primary"
            secondary
            :disabled="!selectedVideos.length"
            @click="clipBatch"
          >
            批量剪辑（勾选视频）
          </NButton>
          <span style="font-size: 12px; opacity: 0.6;">
            提示：勾选表格行后点击批量剪辑；每行需先通过「播放/标记」添加片段
          </span>
        </NSpace>
      </template>
    </NCard>

    <!-- 播放 / 标记弹窗 -->
    <NModal
      v-model:show="playerOpen"
      preset="card"
      title="视频播放与片段标记"
      :style="{ width: '860px' }"
      @after-leave="onPlayerClose"
    >
      <div v-if="currentVideo">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <NTag type="info" style="max-width: 460px;">{{ currentVideo.name }}</NTag>
          <span style="font-size: 12px; opacity: 0.65;">
            快捷键：<b>[</b> 标记起点 &nbsp;<b>]</b> 标记终点
          </span>
        </div>

        <video
          ref="videoEl"
          :key="currentVideo.path"
          :src="toMediaUrl(currentVideo.path)"
          controls
          autoplay
          playsinline
          style="width: 100%; max-height: 400px; background: #000; border-radius: 8px;"
          @timeupdate="onTimeUpdate"
        />

        <div style="display: flex; align-items: center; justify-content: space-between; margin: 12px 0;">
          <NSpace align="center">
            <NButton type="primary" @click="markStart">标记起点</NButton>
            <NButton type="primary" @click="markEnd">标记终点</NButton>
            <NTag v-if="pendingStart != null" type="warning">起点：{{ formatTime(pendingStart) }}</NTag>
            <NTag v-else type="default">未设置起点</NTag>
          </NSpace>
          <span style="font-size: 13px;">
            当前：{{ formatTime(currentTime) }} / {{ formatTime(currentVideo.duration) }}
          </span>
        </div>

        <NAlert type="info" style="margin-bottom: 12px;">
          播放过程中点击「标记起点」「标记终点」即可添加一段剪辑范围，可标记多组；下方列表可直接修改起止时间与片段名称。
        </NAlert>

        <div style="font-weight: 600; margin-bottom: 8px;">片段列表（{{ playerMarks.length }} 组）</div>
        <div v-if="playerMarks.length" style="max-height: 200px; overflow: auto;">
          <div
            v-for="m in playerMarks"
            :key="m.id"
            style="display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px dashed rgba(128,128,128,0.25);"
          >
            <NInput v-model:value="m.name" size="small" style="width: 140px;" placeholder="片段名称" />
            <NInputNumber v-model:value="m.start" size="small" :min="0" :max="currentVideo.duration" :step="0.1" :precision="2" style="width: 120px;" />
            <span style="opacity: 0.6;">~</span>
            <NInputNumber v-model:value="m.end" size="small" :min="0" :max="currentVideo.duration" :step="0.1" :precision="2" style="width: 120px;" />
            <span style="font-size: 12px; opacity: 0.7;">时长 {{ formatDuration(m.end - m.start) }}</span>
            <NButton size="tiny" type="error" quaternary @click="removeMark(m.id)">删除</NButton>
          </div>
        </div>
        <NEmpty v-else description="暂无片段，播放后点击「标记起点 / 标记终点」添加" :show-description="true" style="padding: 12px 0;" />

        <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
          <NSpace>
            <NButton @click="playerOpen = false">取消</NButton>
            <NButton type="primary" :disabled="!playerMarks.length" @click="saveMarks">保存标记</NButton>
          </NSpace>
        </div>
      </div>
    </NModal>

    <!-- 剪辑设置弹窗 -->
    <NModal
      v-model:show="clipModalOpen"
      preset="card"
      title="剪辑设置"
      :style="{ width: '560px' }"
    >
      <div style="display: flex; flex-direction: column; gap: 18px;">
        <div>
          <div style="font-size: 12px; opacity: 0.6; margin-bottom: 6px;">剪辑对象</div>
          <NTag type="info">{{ clipSummary }}</NTag>
        </div>
        <div>
          <div style="font-size: 12px; opacity: 0.6; margin-bottom: 6px;">输出画质</div>
          <NSelect v-model:value="clipQuality" :options="qualityOptions" style="width: 260px;" />
        </div>
        <div>
          <div style="font-size: 12px; opacity: 0.6; margin-bottom: 6px;">叠加片段名称</div>
          <NSpace align="center">
            <NSwitch v-model:value="clipBurnText" />
            <span style="font-size: 12px; opacity: 0.65;">
              将片段名称以水印样式叠加在画面（前 2 秒显示），并作为封面嵌入视频（VLC 等播放器会显示为封面海报）
              <template v-if="clipQuality === 'original' && clipBurnText">
                （原画模式将自动重编码以叠加文字）
              </template>
            </span>
          </NSpace>
        </div>
        <div v-if="clipBurnText" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
          <div>
            <div style="font-size: 12px; opacity: 0.6; margin-bottom: 6px;">水印位置</div>
            <NSelect
              v-model:value="clipWatermarkPosition"
              :options="watermarkPositionOptions"
              size="small"
            />
          </div>
          <div>
            <div style="font-size: 12px; opacity: 0.6; margin-bottom: 6px;">字号</div>
            <NSelect
              v-model:value="clipWatermarkFontSize"
              :options="watermarkFontSizeOptions"
              size="small"
            />
          </div>
          <div>
            <div style="font-size: 12px; opacity: 0.6; margin-bottom: 6px;">颜色</div>
            <NSelect
              v-model:value="clipWatermarkColor"
              :options="watermarkColorOptions"
              size="small"
            />
          </div>
        </div>
        <div>
          <div style="font-size: 12px; opacity: 0.6; margin-bottom: 6px;">输出目录</div>
          <NSpace align="center">
            <NTag :type="clipOutputDir ? 'success' : 'default'" style="max-width: 320px;">
              {{ clipOutputDir || '未选择输出目录' }}
            </NTag>
            <NButton size="small" @click="selectOutputDir">选择目录</NButton>
          </NSpace>
        </div>
        <div style="display: flex; justify-content: flex-end;">
          <NButton type="primary" :disabled="!clipOutputDir" @click="startClip">开始剪辑</NButton>
        </div>
      </div>
    </NModal>

    <!-- 进度 / 结果弹窗 -->
    <NModal
      v-model:show="progressOpen"
      preset="card"
      title="剪辑进度"
      :style="{ width: '560px' }"
      :closable="!processing"
      :mask-closable="!processing"
    >
      <div v-if="!resultState" style="display: flex; flex-direction: column; gap: 14px; padding: 6px 0;">
        <NProgress
          type="line"
          :percentage="overallPercent"
          :processing="processing"
          :height="18"
          indicator-placement="inside"
        />
        <div style="font-size: 13px; opacity: 0.8;">
          总体进度：{{ currentFileIndex + 1 }} / {{ totalFiles }} 个视频
        </div>
        <NProgress
          type="line"
          :percentage="localPercent"
          status="info"
          :height="10"
          indicator-placement="inside"
        />
        <div style="font-size: 12px; opacity: 0.6;">{{ progressText || '准备中…' }}</div>
      </div>

      <div v-else style="display: flex; flex-direction: column; gap: 14px; padding: 6px 0;">
        <NAlert type="success" :show-icon="true">
          剪辑完成：成功 {{ resultState.successCount }} 段，失败 {{ resultState.failCount }} 段
        </NAlert>
        <div v-if="resultState.outputs.length" style="max-height: 160px; overflow: auto; font-size: 12px; opacity: 0.75;">
          <div v-for="(o, i) in resultState.outputs" :key="i">✓ {{ o }}</div>
        </div>
        <div v-if="resultState.errors.length">
          <div style="font-size: 12px; opacity: 0.7; margin-bottom: 4px;">失败原因：</div>
          <div v-for="(e, i) in resultState.errors" :key="i" style="font-size: 12px; color: #e88080;">
            ✗ {{ e }}
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end;">
          <NSpace>
            <NButton @click="progressOpen = false">完成</NButton>
            <NButton type="primary" @click="openOutputDir">打开输出文件夹</NButton>
          </NSpace>
        </div>
      </div>
    </NModal>
  </div>
</template>
