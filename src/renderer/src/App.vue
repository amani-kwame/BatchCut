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
  enUS,
  dateEnUS,
  darkTheme
} from 'naive-ui'
import TitleBar from './components/TitleBar.vue'
import FfmpegGuideModal from './components/FfmpegGuideModal.vue'
import VideoProcessor from './pages/VideoProcessor.vue'
import { locale, toggleLocale, t } from './i18n'

// naive-ui 组件内置文案跟随语言
const naiveLocale = computed(() => (locale.value === 'zh' ? zhCN : enUS))
const naiveDateLocale = computed(() => (locale.value === 'zh' ? dateZhCN : dateEnUS))

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

// ---------- FFmpeg 安装教程弹窗 ----------
const showGuide = ref(false)

function openFfmpegGuide(): void {
  showGuide.value = true
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
  if (theme.value === 'system') return t('theme.system')
  return isDark.value ? t('theme.dark') : t('theme.light')
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
    :locale="naiveLocale"
    :date-locale="naiveDateLocale"
    class="app-root"
  >
    <NMessageProvider>
      <div class="app-container" :class="{ dark: isDark }">
        <TitleBar />

        <NLayout class="main-layout">
          <div class="page-header">
            <div class="header-title">
              <span class="title-icon">🎬</span>
              <span class="title-text">{{ t('app.headerTitle') }}</span>
            </div>
            <NSpace align="center">
              <NPopover trigger="hover" placement="bottom-end">
                <template #trigger>
                  <NButton quaternary size="small" :title="t('app.langHint')" @click="toggleLocale">
                    <template #icon>
                      <span>🌐</span>
                    </template>
                    {{ t('app.switchLang') }}
                  </NButton>
                </template>
                <div style="font-size: 12px; line-height: 1.6;">
                  {{ t('app.langHint') }}
                </div>
              </NPopover>
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
                  {{ t('theme.popoverHint') }}
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
          :title="t('ffmpeg.missingTitle')"
          style="max-width: 560px;"
        >
          <NAlert type="warning" :bordered="false" style="margin-bottom: 16px;">
            <template #header>{{ t('ffmpeg.missingHeader') }}</template>
            <div style="font-size: 13px; line-height: 1.7;">
              {{ t('ffmpeg.missingBody') }}
            </div>
          </NAlert>
          <NSpace justify="end">
            <NButton @click="ffmpegMissing = false">{{ t('ffmpeg.later') }}</NButton>
            <NButton type="primary" @click="openFfmpegGuide">{{ t('ffmpeg.viewGuide') }}</NButton>
          </NSpace>
        </NModal>

        <!-- FFmpeg 安装教程（应用内双语弹窗，离线可用） -->
        <FfmpegGuideModal v-model:show="showGuide" />
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
