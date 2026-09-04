<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  NConfigProvider,
  NMessageProvider,
  NLayout,
  NButton,
  NSpace,
  NPopover,
  NModal,
  NAlert,
  zhCN,
  dateZhCN,
  darkTheme
} from 'naive-ui'
import TitleBar from './components/TitleBar.vue'
import VideoProcessor from './pages/VideoProcessor.vue'

// ---------- FFmpeg 检测 ----------
const ffmpegMissing = ref(false)
const ffmpegCheckDone = ref(false)

async function checkFfmpeg(): Promise<void> {
  try {
    const res = await window.api.video.checkFfmpeg()
    ffmpegMissing.value = !(res.ffmpeg && res.ffprobe)
  } catch {
    // 检测失败不阻断使用，静默忽略
  } finally {
    ffmpegCheckDone.value = true
  }
}

function openFfmpegGuide(): void {
  window.api.video.openFfmpegGuide()
}

// 主题切换（localStorage 持久化 + 跟随系统）
type Theme = 'system' | 'light' | 'dark'

function readInitialTheme(): Theme {
  const stored = localStorage.getItem('batch-cut-theme') as Theme | null
  if (stored === 'light' || stored === 'dark') return stored
  return 'system'
}

const theme = ref<Theme>(readInitialTheme())
const isDark = ref(false)

function applyNativeTheme(t: Theme): void {
  // 同步到 Electron 主进程，确保原生窗口组件也跟随
  window.api.theme.set(t).then((nowDark) => {
    isDark.value = nowDark
  }).catch(() => {
    // 兜底：通过 matchMedia 判断
    isDark.value = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })
}

watch(theme, (t) => {
  localStorage.setItem('batch-cut-theme', t)
  applyNativeTheme(t)
})

const themeLabel = computed(() => {
  if (theme.value === 'system') return '跟随系统'
  return isDark.value ? '深色' : '浅色'
})

function toggleTheme(): void {
  // system → light → dark → system
  if (theme.value === 'system') theme.value = 'light'
  else if (theme.value === 'light') theme.value = 'dark'
  else theme.value = 'system'
}

onMounted(async () => {
  applyNativeTheme(theme.value)
  checkFfmpeg()
})
</script>

<template>
  <NConfigProvider
    :theme="isDark ? darkTheme : null"
    :locale="zhCN"
    :date-locale="dateZhCN"
    class="app-root"
  >
    <NMessageProvider>
      <div class="app-container" :class="{ dark: isDark }">
        <TitleBar />

        <NLayout class="main-layout">
          <div class="page-header">
            <div class="header-title">
              <span class="title-icon">🎬</span>
              <span class="title-text">视频批量剪辑</span>
            </div>
            <NSpace align="center">
              <NPopover trigger="hover" placement="bottom-end">
                <template #trigger>
                  <NButton quaternary size="small" @click="toggleTheme">
                    <template #icon>
                      <span>{{ theme === 'system' ? '🖥️' : isDark ? '🌙' : '☀️' }}</span>
                    </template>
                    {{ themeLabel }}
                  </NButton>
                </template>
                <div style="font-size: 12px; line-height: 1.6;">
                  点击循环切换：跟随系统 → 浅色 → 深色
                </div>
              </NPopover>
            </NSpace>
          </div>

          <div class="page-body">
            <VideoProcessor />
          </div>
        </NLayout>

        <!-- FFmpeg 未安装提示 -->
        <NModal
          v-model:show="ffmpegMissing"
          :mask-closable="false"
          :closable="false"
          preset="card"
          title="检测到 FFmpeg 未安装"
          style="max-width: 560px;"
        >
          <NAlert type="warning" :bordered="false" style="margin-bottom: 16px;">
            <template #header>视频剪辑功能依赖 FFmpeg</template>
            <div style="font-size: 13px; line-height: 1.7;">
              本工具需要 <b>ffmpeg</b> 与 <b>ffprobe</b> 才能扫描视频信息、剪辑片段、叠加水印和生成封面。
              当前未检测到可用的 FFmpeg，请先安装。
            </div>
          </NAlert>
          <NSpace justify="end">
            <NButton @click="ffmpegMissing = false">稍后处理</NButton>
            <NButton type="primary" @click="openFfmpegGuide">查看安装教程</NButton>
          </NSpace>
        </NModal>
      </div>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style scoped>
.app-root {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.main-layout {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.page-header {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid var(--border-color, #e8e8e8);
  flex-shrink: 0;
  background: var(--card-bg, #fafafa);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-icon {
  font-size: 18px;
}

.title-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--primary, #1677ff);
}

.page-body {
  flex: 1;
  overflow: auto;
  padding: 16px 20px 20px;
}
</style>
