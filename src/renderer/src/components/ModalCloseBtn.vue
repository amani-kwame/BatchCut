<script setup lang="ts">
import { t } from '../i18n'

const emit = defineEmits<{ (e: 'close'): void }>()
</script>

<template>
  <!-- 与标题栏同款的 Windows 风格关闭按钮，绝对定位贴住弹窗卡片右上角 -->
  <button class="modal-close-btn" type="button" :title="t('titlebar.close')" @click="emit('close')">
    <svg width="12" height="12" viewBox="0 0 12 12">
      <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" stroke-width="1.3" />
      <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" stroke-width="1.3" />
    </svg>
  </button>
</template>
