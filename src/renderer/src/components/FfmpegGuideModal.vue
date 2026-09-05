<script setup lang="ts">
import { NModal, NButton, NSpace } from 'naive-ui'
import { t } from '../i18n'
import ModalCloseBtn from './ModalCloseBtn.vue'
import guideImg1 from '../assets/ffmpeg-guide-1.png'
import guideImg2 from '../assets/ffmpeg-guide-2.png'

defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()

const DOWNLOAD_URL = 'https://github.com/BtbN/FFmpeg-Builds/releases'

function openDownloadPage(): void {
  window.api.video.openExternal(DOWNLOAD_URL)
}

function close(): void {
  emit('update:show', false)
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="t('guide.title')"
    style="max-width: 680px;"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <ModalCloseBtn @close="close" />
    <div class="guide-body">
      <!-- Step 1 -->
      <div class="step">
        <div class="step-title">
          <span class="step-num">1</span>
          <span>{{ t('guide.step1.title') }}</span>
        </div>
        <div class="step-body">{{ t('guide.step1.body') }}</div>
      </div>

      <!-- Step 2 -->
      <div class="step">
        <div class="step-title">
          <span class="step-num">2</span>
          <span>{{ t('guide.step2.title') }}</span>
        </div>
        <div class="step-body">{{ t('guide.step2.body') }}</div>
        <img class="step-img" :src="guideImg1" :alt="t('guide.step2.imgAlt')" />
      </div>

      <!-- Step 3 -->
      <div class="step">
        <div class="step-title">
          <span class="step-num">3</span>
          <span>{{ t('guide.step3.title') }}</span>
        </div>
        <div class="step-body">
          {{ t('guide.step3.body') }}
          <code class="step-code">D:\tools\ffmpeg*\bin\</code>
        </div>
        <img class="step-img" :src="guideImg2" :alt="t('guide.step3.imgAlt')" />
      </div>

      <div class="guide-note">{{ t('guide.note') }}</div>
    </div>

    <template #footer>
      <NSpace justify="space-between" align="center">
        <NButton quaternary size="small" @click="openDownloadPage">
          {{ t('guide.openDownloadPage') }}
        </NButton>
        <NButton type="primary" @click="close">{{ t('guide.done') }}</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.guide-body {
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 4px;
}

.step {
  margin-bottom: 20px;
}

.step:last-of-type {
  margin-bottom: 0;
}

.step-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
}

.step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--primary, #1677ff);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.step-body {
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-color, #333);
  margin-bottom: 8px;
  padding-left: 28px;
}

.step-code {
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(128, 128, 128, 0.12);
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
}

.step-img {
  display: block;
  width: 100%;
  max-width: 560px;
  margin: 4px 0 0 28px;
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 6px;
}

.guide-note {
  margin-top: 16px;
  padding: 10px 12px;
  border-radius: 6px;
  background: rgba(22, 119, 255, 0.08);
  font-size: 13px;
  line-height: 1.6;
}
</style>
