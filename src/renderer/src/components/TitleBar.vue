<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { t } from '../i18n'

const isMaximized = ref(false)

function minimize(): void {
  window.api.window.minimize()
}

function toggleMaximize(): void {
  window.api.window.maximize()
  isMaximized.value = !isMaximized.value
}

function close(): void {
  window.api.window.close()
}

onMounted(async () => {
  isMaximized.value = await window.api.window.isMaximized()
})
</script>

<template>
  <div class="title-bar" :style="{ WebkitAppRegion: 'drag' } as any">
    <div class="title-bar-left">
      <span class="app-name">{{ t('app.name') }}</span>
    </div>
    <div class="title-bar-controls" :style="{ WebkitAppRegion: 'no-drag' } as any">
      <button class="ctrl-btn minimize" :title="t('titlebar.minimize')" @click="minimize">
        <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor" /></svg>
      </button>
      <button class="ctrl-btn maximize" :title="isMaximized ? t('titlebar.restore') : t('titlebar.maximize')" @click="toggleMaximize">
        <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" /></svg>
        <svg v-else width="10" height="10" viewBox="0 0 10 10">
          <rect x="2" y="0" width="8" height="8" fill="none" stroke="currentColor" />
          <rect x="0" y="2" width="8" height="8" fill="var(--titlebar-bg, #f5f5f5)" stroke="currentColor" />
        </svg>
      </button>
      <button class="ctrl-btn close" :title="t('titlebar.close')" @click="close">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1.2" />
          <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1.2" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.title-bar {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--titlebar-bg, #f5f5f5);
  border-bottom: 1px solid var(--border-color, #e8e8e8);
  user-select: none;
  flex-shrink: 0;
}

.title-bar-left {
  padding-left: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-name {
  font-size: 12px;
  color: #666;
}

.title-bar-controls {
  display: flex;
  align-items: center;
}

.ctrl-btn {
  width: 46px;
  height: 36px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: background 0.15s;
}

.ctrl-btn:hover {
  background: rgba(0, 0, 0, 0.08);
}

.ctrl-btn.close:hover {
  background: #e81123;
  color: white;
}
</style>
