<template>
  <div class="message-bubble" :class="[message.role]">
    <div class="bubble-content">
      <div class="text" v-html="renderedContent"></div>
      <div v-if="message.screenshot" class="screenshot-preview">
        <img :src="message.screenshot" alt="页面截图" @click="expandScreenshot = !expandScreenshot" />
        <div v-if="expandScreenshot" class="screenshot-overlay" @click="expandScreenshot = false">
          <img :src="message.screenshot" alt="页面截图（大图）" />
        </div>
      </div>
      <CodeBlock
        v-if="message.code"
        :code="message.code"
        @execute="$emit('execute', message.code)"
        @save="$emit('save', message.code)"
      />
    </div>
    <div class="timestamp">{{ formatTime(message.timestamp) }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChatMessage } from '@/shared/types'
import CodeBlock from './CodeBlock.vue'

const props = defineProps<{ message: ChatMessage }>()
defineEmits<{
  execute: [code: string]
  save: [code: string]
}>()

const expandScreenshot = ref(false)

const renderedContent = computed(() => {
  let text = props.message.content
  // Remove the code block from display text since CodeBlock handles it
  text = text.replace(/```javascript\s*\n[\s\S]*?\n```/g, '')
  // Basic markdown: bold, inline code
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>')
  text = text.replace(/\n/g, '<br/>')
  return text.trim()
})

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped>
.message-bubble {
  margin-bottom: 12px;
  max-width: 95%;
}

.message-bubble.user {
  margin-left: auto;
}

.message-bubble.assistant {
  margin-right: auto;
}

.message-bubble.system {
  margin: 4px auto;
  max-width: 100%;
}

.bubble-content {
  padding: 10px 14px;
  border-radius: 12px;
  line-height: 1.6;
  word-break: break-word;
}

.user .bubble-content {
  background: #6c5ce7;
  color: white;
  border-bottom-right-radius: 4px;
}

.assistant .bubble-content {
  background: white;
  color: #1a1a1a;
  border: 1px solid #e0e0e0;
  border-bottom-left-radius: 4px;
}

.system .bubble-content {
  background: #f8f9fa;
  color: #666;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  font-size: 12px;
  padding: 6px 10px;
}

.bubble-content :deep(code) {
  background: rgba(0,0,0,0.08);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: 'Fira Code', monospace;
  font-size: 12px;
}

.user .bubble-content :deep(code) {
  background: rgba(255,255,255,0.2);
}

.timestamp {
  font-size: 10px;
  color: #999;
  margin-top: 2px;
  padding: 0 4px;
}

.user .timestamp {
  text-align: right;
}

.screenshot-preview {
  margin-top: 8px;
  cursor: pointer;
}

.screenshot-preview > img {
  max-width: 100%;
  max-height: 160px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.3);
  object-fit: contain;
}

.screenshot-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  cursor: pointer;
}

.screenshot-overlay img {
  max-width: 95%;
  max-height: 95%;
  border-radius: 8px;
  object-fit: contain;
}
</style>
