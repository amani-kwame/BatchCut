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
import { t } from '../i18n'
import ModalCloseBtn from '../components/ModalCloseBtn.vue'

const message = useMessage()

// ---------- 文件夹与视频列表 ----------
const scanning = ref(false)

const qualityOptions = computed(() => [
  { label: t('vp.quality.original'), value: 'original' },
  { label: t('vp.quality.p480'), value: 'p480' },
  { label: t('vp.quality.high'), value: 'high' },
  { label: t('vp.quality.medium'), value: 'medium' },
  { label: t('vp.quality.low'), value: 'low' }
])

/** 水印位置 5 档（左上 / 右上 / 居中 / 左下 / 右下） */
const watermarkPositionOptions = computed(() => [
  { label: t('vp.pos.topLeft'), value: 'top-left' },
  { label: t('vp.pos.topRight'), value: 'top-right' },
  { label: t('vp.pos.center'), value: 'center' },
  { label: t('vp.pos.bottomLeft'), value: 'bottom-left' },
  { label: t('vp.pos.bottomRight'), value: 'bottom-right' }
])

/** 水印字号 4 档（small / medium / large 默认 / xlarge） */
const watermarkFontSizeOptions = computed(() => [
  { label: t('vp.font.small'), value: 'small' },
  { label: t('vp.font.medium'), value: 'medium' },
  { label: t('vp.font.large'), value: 'large' },
  { label: t('vp.font.xlarge'), value: 'xlarge' }
])

/** 水印颜色 8 色预设 */
const watermarkColorOptions = computed(() => [
  { label: t('vp.color.red'), value: '0xFF0000' },
  { label: t('vp.color.orange'), value: '0xFF8C00' },
  { label: t('vp.color.yellow'), value: '0xFFFF00' },
  { label: t('vp.color.green'), value: '0x00C853' },
  { label: t('vp.color.blue'), value: '0x2196F3' },
  { label: t('vp.color.purple'), value: '0x9C27B0' },
  { label: t('vp.color.white'), value: '0xFFFFFF' },
  { label: t('vp.color.black'), value: '0x000000' }
])

/** 手动清空：视频列表、标记片段、勾选状态（剪辑设置保留） */
function clearAll(): void {
  folderPath.value = ''
  videos.value = []
  selectedRowKeys.value = []
  message.success(t('vp.msgCleared'))
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
    if (list.length) message.success(t('vp.msgScanned', { n: list.length }))
    else message.info(t('vp.msgNoVideo'))
  } catch (e) {
    message.error(t('vp.msgScanFail', { err: (e as Error).message }))
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
  message.info(t('vp.msgStartMarked', { time: formatTime(el.currentTime) }))
}

function markEnd(): void {
  const el = videoEl.value
  if (!el) return
  const start = pendingStart.value
  const end = el.currentTime
  if (start == null) {
    message.warning(t('vp.msgMarkStartFirst'))
    return
  }
  if (end <= start) {
    message.warning(t('vp.msgEndAfterStart'))
    return
  }
  playerMarks.value.push({
    id: markSeq++,
    start: Math.round(start * 100) / 100,
    end: Math.round(end * 100) / 100,
    name: t('vp.defaultMarkName', { n: playerMarks.value.length + 1 })
  })
  pendingStart.value = null
  message.success(t('vp.msgMarkAdded', { start: formatTime(start), end: formatTime(end) }))
}

function removeMark(id: number): void {
  playerMarks.value = playerMarks.value.filter((m) => m.id !== id)
}

function saveMarks(): void {
  const invalid = playerMarks.value.find((m) => !(m.end > m.start))
  if (invalid) {
    message.warning(t('vp.msgInvalidMark'))
    return
  }
  if (currentVideo.value) {
    currentVideo.value.marks = playerMarks.value.map((m) => ({ ...m }))
  }
  playerOpen.value = false
  message.success(t('vp.msgMarksSaved', { n: playerMarks.value.length }))
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
    message.warning(t('vp.msgNoMarksSingle'))
    return
  }
  clipMode.value = 'single'
  clipTargets.value = [row]
  clipModalOpen.value = true
}

function clipBatch(): void {
  const targets = videos.value.filter((v) => selectedRowKeys.value.includes(v.path) && v.marks.length)
  if (!targets.length) {
    message.warning(t('vp.msgNoMarksBatch'))
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
  if (clipMode.value === 'single')
    return t('vp.clipSummarySingle', { videos: clipTargets.value.length, segs: segCount })
  return t('vp.clipSummaryBatch', { videos: clipTargets.value.length, segs: segCount })
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
    progressText.value = t('vp.progressText', {
      file: p.fileName,
      cur: p.segmentIndex + 1,
      total: p.segmentCount
    })
    overallPercent.value = Math.round(
      ((currentFileIndex.value + p.localPercent / 100) / total) * 100
    )
  })
}

async function startClip(): Promise<void> {
  if (!clipTargets.value.length) return
  if (!clipOutputDir.value) {
    message.warning(t('vp.msgPickOutputDir'))
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
        errors.push(t('vp.msgFileError', { name: v.name, err: (e as Error).message }))
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
  if (err) message.error(t('vp.msgOpenFolderFail', { err }))
}

onBeforeUnmount(() => {
  progressOff?.()
  window.removeEventListener('keydown', onKeydown)
})

// ---------- 格式化 ----------
/** 路径中间省略：超长时保留首尾、中间以 … 代替，避免截断掉关键信息 */
function middleEllipsis(text: string, max = 48): string {
  if (text.length <= max) return text
  const keep = Math.floor((max - 1) / 2)
  return text.slice(0, keep) + '…' + text.slice(text.length - keep)
}

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

// ---------- 表格列（computed：语言切换时表头实时更新） ----------
const columns = computed<DataTableColumns<VideoRow>>(() => [
  { type: 'selection', width: 40 },
  {
    title: t('vp.col.name'),
    key: 'name',
    minWidth: 220,
    ellipsis: { tooltip: true }
  },
  {
    title: t('vp.col.duration'),
    key: 'duration',
    width: 90,
    render: (row) => formatDuration(row.duration)
  },
  {
    title: t('vp.col.resolution'),
    key: 'resolution',
    width: 100,
    render: (row) => (row.width && row.height ? `${row.width}×${row.height}` : '--')
  },
  {
    title: t('vp.col.size'),
    key: 'size',
    width: 90,
    render: (row) => formatSize(row.size)
  },
  {
    title: t('vp.col.marks'),
    key: 'marks',
    width: 100,
    render: (row) =>
      row.marks.length
        ? h(NTag, { type: 'success', size: 'small' }, { default: () => t('vp.marksCount', { n: row.marks.length }) })
        : h(NTag, { type: 'default', size: 'small' }, { default: () => t('vp.unmarked') })
  },
  {
    title: t('vp.col.actions'),
    key: 'actions',
    width: 190,
    fixed: 'right',
    render: (row) =>
      h(NSpace, { size: 8 }, {
        default: () => [
          h(
            NButton,
            { size: 'small', onClick: () => openPlayer(row) },
            { default: () => t('vp.playMark') }
          ),
          h(
            NButton,
            { size: 'small', type: 'primary', secondary: true, onClick: () => clipSingle(row) },
            { default: () => t('vp.clip') }
          )
        ]
      })
  }
])
</script>

<template>
  <div>
    <!-- 文件夹选择 -->
    <NCard :bordered="false" style="margin-bottom: 16px;">
      <NSpace align="center" wrap>
        <NButton type="primary" :loading="scanning" @click="selectFolder">{{ t('vp.selectFolder') }}</NButton>
        <NButton v-if="folderPath" :loading="scanning" @click="scanFolder">{{ t('vp.rescan') }}</NButton>
        <NPopconfirm
          v-if="folderPath || videos.length"
          @positive-click="clearAll"
        >
          <template #trigger>
            <NButton type="error" secondary>{{ t('vp.clear') }}</NButton>
          </template>
          {{ t('vp.clearConfirm') }}
        </NPopconfirm>
        <NTag v-if="folderPath" type="info" style="max-width: 480px;" :title="folderPath">{{ middleEllipsis(folderPath) }}</NTag>
        <NTag v-if="videos.length" type="success">{{ t('vp.videoCount', { n: videos.length }) }}</NTag>
      </NSpace>
    </NCard>

    <!-- 视频表格 + 批量剪辑 -->
    <NCard :bordered="false" :title="t('vp.listTitle')">
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
      <NEmpty v-else :description="t('vp.emptyHint')" style="padding: 40px 0;" />
      <template #footer>
        <NSpace align="center" wrap style="margin-top: 4px;">
          <NTag v-if="selectedVideos.length" type="warning">
            {{ t('vp.selectedInfo', { videos: selectedVideos.length, marks: selectedMarkCount }) }}
          </NTag>
          <NButton
            type="primary"
            secondary
            :disabled="!selectedVideos.length"
            @click="clipBatch"
          >
            {{ t('vp.batchClip') }}
          </NButton>
          <span style="font-size: 12px; opacity: 0.6;">
            {{ t('vp.batchHint') }}
          </span>
        </NSpace>
      </template>
    </NCard>

    <!-- 播放 / 标记弹窗 -->
    <NModal
      v-model:show="playerOpen"
      preset="card"
      :title="t('vp.playerTitle')"
      :style="{ width: '860px' }"
      @after-leave="onPlayerClose"
    >
      <!-- 关闭按钮固定在卡片右上角，不随内容滚动 -->
      <ModalCloseBtn @close="playerOpen = false" />
      <!-- 内容区限制高度并内部滚动，保证弹窗不超出屏幕（关闭按钮始终可见） -->
      <div v-if="currentVideo" style="max-height: calc(100vh - 180px); overflow-y: auto; padding-right: 4px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <NTag type="info" style="max-width: 460px;">{{ currentVideo.name }}</NTag>
          <span style="font-size: 12px; opacity: 0.65;">
            {{ t('vp.shortcuts') }}
          </span>
        </div>

        <video
          ref="videoEl"
          :key="currentVideo.path"
          :src="toMediaUrl(currentVideo.path)"
          controls
          autoplay
          playsinline
          style="width: 100%; max-height: min(400px, 45vh); background: #000; border-radius: 8px;"
          @timeupdate="onTimeUpdate"
        />

        <div style="display: flex; align-items: center; justify-content: space-between; margin: 12px 0;">
          <NSpace align="center">
            <NButton type="primary" @click="markStart">{{ t('vp.markStart') }}</NButton>
            <NButton type="primary" @click="markEnd">{{ t('vp.markEnd') }}</NButton>
            <NTag v-if="pendingStart != null" type="warning">{{ t('vp.startAt', { time: formatTime(pendingStart) }) }}</NTag>
            <NTag v-else type="default">{{ t('vp.noStart') }}</NTag>
          </NSpace>
          <span style="font-size: 13px;">
            {{ t('vp.currentTime', { cur: formatTime(currentTime), total: formatTime(currentVideo.duration) }) }}
          </span>
        </div>

        <NAlert type="info" style="margin-bottom: 12px;">
          {{ t('vp.playerHint') }}
        </NAlert>

        <div style="font-weight: 600; margin-bottom: 8px;">{{ t('vp.segmentList', { n: playerMarks.length }) }}</div>
        <div v-if="playerMarks.length" style="max-height: 200px; overflow: auto;">
          <div
            v-for="m in playerMarks"
            :key="m.id"
            style="display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px dashed rgba(128,128,128,0.25);"
          >
            <NInput v-model:value="m.name" size="small" style="width: 140px;" :placeholder="t('vp.markNamePlaceholder')" />
            <NInputNumber v-model:value="m.start" size="small" :min="0" :max="currentVideo.duration" :step="0.1" :precision="2" style="width: 120px;" />
            <span style="opacity: 0.6;">~</span>
            <NInputNumber v-model:value="m.end" size="small" :min="0" :max="currentVideo.duration" :step="0.1" :precision="2" style="width: 120px;" />
            <span style="font-size: 12px; opacity: 0.7;">{{ t('vp.markDuration', { d: formatDuration(m.end - m.start) }) }}</span>
            <NButton size="tiny" type="error" quaternary @click="removeMark(m.id)">{{ t('vp.delete') }}</NButton>
          </div>
        </div>
        <NEmpty v-else :description="t('vp.emptyMarks')" :show-description="true" style="padding: 12px 0;" />

        <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
          <NSpace>
            <NButton @click="playerOpen = false">{{ t('vp.cancel') }}</NButton>
            <NButton type="primary" :disabled="!playerMarks.length" @click="saveMarks">{{ t('vp.saveMarks') }}</NButton>
          </NSpace>
        </div>
      </div>
    </NModal>

    <!-- 剪辑设置弹窗 -->
    <NModal
      v-model:show="clipModalOpen"
      preset="card"
      :title="t('vp.clipSettings')"
      :style="{ width: '560px' }"
    >
      <div style="display: flex; flex-direction: column; gap: 18px;">
        <ModalCloseBtn @close="clipModalOpen = false" />
        <div>
          <div style="font-size: 12px; opacity: 0.6; margin-bottom: 6px;">{{ t('vp.clipTargets') }}</div>
          <NTag type="info">{{ clipSummary }}</NTag>
        </div>
        <div>
          <div style="font-size: 12px; opacity: 0.6; margin-bottom: 6px;">{{ t('vp.outputQuality') }}</div>
          <NSelect v-model:value="clipQuality" :options="qualityOptions" style="width: 260px;" />
        </div>
        <div>
          <div style="font-size: 12px; opacity: 0.6; margin-bottom: 6px;">{{ t('vp.burnText') }}</div>
          <NSpace align="center">
            <NSwitch v-model:value="clipBurnText" />
            <span style="font-size: 12px; opacity: 0.65;">
              {{ t('vp.burnHint') }}
              <template v-if="clipQuality === 'original' && clipBurnText">
                {{ t('vp.originalNote') }}
              </template>
            </span>
          </NSpace>
        </div>
        <div v-if="clipBurnText" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
          <div>
            <div style="font-size: 12px; opacity: 0.6; margin-bottom: 6px;">{{ t('vp.watermarkPosition') }}</div>
            <NSelect
              v-model:value="clipWatermarkPosition"
              :options="watermarkPositionOptions"
              size="small"
            />
          </div>
          <div>
            <div style="font-size: 12px; opacity: 0.6; margin-bottom: 6px;">{{ t('vp.fontSize') }}</div>
            <NSelect
              v-model:value="clipWatermarkFontSize"
              :options="watermarkFontSizeOptions"
              size="small"
            />
          </div>
          <div>
            <div style="font-size: 12px; opacity: 0.6; margin-bottom: 6px;">{{ t('vp.color') }}</div>
            <NSelect
              v-model:value="clipWatermarkColor"
              :options="watermarkColorOptions"
              size="small"
            />
          </div>
        </div>
        <div>
          <div style="font-size: 12px; opacity: 0.6; margin-bottom: 6px;">{{ t('vp.outputDir') }}</div>
          <NSpace align="center">
            <NTag :type="clipOutputDir ? 'success' : 'default'" style="max-width: 320px;" :title="clipOutputDir || t('vp.noOutputDir')">
              {{ clipOutputDir ? middleEllipsis(clipOutputDir, 36) : t('vp.noOutputDir') }}
            </NTag>
            <NButton size="small" @click="selectOutputDir">{{ t('vp.chooseDir') }}</NButton>
          </NSpace>
        </div>
        <div style="display: flex; justify-content: flex-end;">
          <NButton type="primary" :disabled="!clipOutputDir" @click="startClip">{{ t('vp.startClip') }}</NButton>
        </div>
      </div>
    </NModal>

    <!-- 进度 / 结果弹窗 -->
    <NModal
      v-model:show="progressOpen"
      preset="card"
      :title="t('vp.progressTitle')"
      :style="{ width: '560px' }"
      :closable="false"
      :mask-closable="!processing"
    >
      <!-- 处理中不显示关闭按钮，防止误关；完成后出现 -->
      <ModalCloseBtn v-if="!processing" @close="progressOpen = false" />
      <div v-if="!resultState" style="display: flex; flex-direction: column; gap: 14px; padding: 6px 0;">
        <NProgress
          type="line"
          :percentage="overallPercent"
          :processing="processing"
          :height="18"
          indicator-placement="inside"
        />
        <div style="font-size: 13px; opacity: 0.8;">
          {{ t('vp.overallProgress', { cur: currentFileIndex + 1, total: totalFiles }) }}
        </div>
        <NProgress
          type="line"
          :percentage="localPercent"
          status="info"
          :height="10"
          indicator-placement="inside"
        />
        <div style="font-size: 12px; opacity: 0.6;">{{ progressText || t('vp.preparing') }}</div>
      </div>

      <div v-else style="display: flex; flex-direction: column; gap: 14px; padding: 6px 0;">
        <NAlert type="success" :show-icon="true">
          {{ t('vp.clipDone', { ok: resultState.successCount, fail: resultState.failCount }) }}
        </NAlert>
        <div v-if="resultState.outputs.length" style="max-height: 160px; overflow: auto; font-size: 12px; opacity: 0.75;">
          <div v-for="(o, i) in resultState.outputs" :key="i">✓ {{ o }}</div>
        </div>
        <div v-if="resultState.errors.length">
          <div style="font-size: 12px; opacity: 0.7; margin-bottom: 4px;">{{ t('vp.failReasons') }}</div>
          <div v-for="(e, i) in resultState.errors" :key="i" style="font-size: 12px; color: #e88080;">
            ✗ {{ e }}
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end;">
          <NSpace>
            <NButton @click="progressOpen = false">{{ t('vp.done') }}</NButton>
            <NButton type="primary" @click="openOutputDir">{{ t('vp.openOutputFolder') }}</NButton>
          </NSpace>
        </div>
      </div>
    </NModal>
  </div>
</template>
