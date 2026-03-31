<template>
  <div class="chat-panel">
    <div class="messages" ref="messagesContainer">
      <div v-if="messages.length === 0" class="empty-state">
        <p>🪄 你好！告诉我你想在网页上做什么。</p>
        <p class="hint">例如："点击登录按钮"、"填写搜索框并搜索'Vue'"</p>
      </div>

      <MessageBubble
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
        @execute="handleExecute"
        @save="handleSave"
      />

      <!-- Streaming indicator -->
      <div v-if="isLoading && streamContent" class="message-bubble assistant">
        <div class="bubble-content streaming">
          <div v-html="renderStream(streamContent)"></div>
          <span class="cursor">▊</span>
        </div>
      </div>

      <div v-if="isLoading && !streamContent" class="loading-indicator">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>

      <!-- Execution result -->
      <div v-if="execResult" class="exec-result" :class="{ success: execResult.success, error: !execResult.success }">
        <strong>{{ execResult.success ? '✅ 执行成功' : '❌ 执行失败' }}</strong>
        <p>{{ execResult.success ? execResult.result : execResult.error }}</p>
      </div>
    </div>

    <div class="input-area">
      <div class="input-row">
        <textarea
          v-model="inputText"
          @keydown.enter.exact.prevent="send"
          placeholder="描述你想执行的操作..."
          rows="2"
          :disabled="isLoading"
        ></textarea>
        <button v-if="isLoading" class="stop-btn" @click="stopGeneration">
          ⏹ 停止
        </button>
        <button v-else class="send-btn" @click="send" :disabled="!inputText.trim()">
          发送
        </button>
      </div>
      <button
        v-if="messages.length > 0"
        class="clear-btn"
        @click="clearMessages"
        :disabled="isLoading"
      >🗑️ 清空对话</button>
    </div>

    <!-- Save dialog -->
    <div v-if="showSaveDialog" class="save-dialog-overlay" @click.self="showSaveDialog = false">
      <div class="save-dialog">
        <h3>保存脚本</h3>
        <div class="save-field">
          <label>名称</label>
          <input v-model="saveForm.name" placeholder="脚本名称" />
        </div>
        <div class="save-field">
          <label>描述</label>
          <input v-model="saveForm.description" placeholder="可选描述" />
        </div>
        <div class="save-field">
          <label>URL 匹配</label>
          <input v-model="saveForm.urlPattern" placeholder="*（匹配所有网页）" />
        </div>
        <div class="save-dialog-actions">
          <button class="save-btn-cancel" @click.stop="showSaveDialog = false">取消</button>
          <button class="save-btn-confirm" @click.stop="confirmSave">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useChat } from '../composables/useChat'
import { useScripts } from '../composables/useScripts'
import MessageBubble from './MessageBubble.vue'

const emit = defineEmits<{ 'save-script': [] }>()

const { messages, isLoading, streamContent, sendMessage, executeCode, clearMessages, stopGeneration } = useChat()
const { addScript } = useScripts()

const inputText = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const execResult = ref<{ success: boolean; result?: string; error?: string } | null>(null)

const showSaveDialog = ref(false)
const pendingSaveCode = ref('')
const saveForm = ref({ name: '', description: '', urlPattern: '*' })

function send() {
  if (!inputText.value.trim() || isLoading.value) return
  const text = inputText.value
  inputText.value = ''
  execResult.value = null
  sendMessage(text)
}

async function handleExecute(code: string) {
  execResult.value = null
  const result = await executeCode(code)
  execResult.value = result
  scrollToBottom()
}

async function getCurrentTabUrl(): Promise<string> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    return tab?.url ?? '*'
  } catch {
    return '*'
  }
}

async function handleSave(code: string) {
  pendingSaveCode.value = code
  const currentUrl = await getCurrentTabUrl()
  saveForm.value = { name: '', description: '', urlPattern: currentUrl }
  showSaveDialog.value = true
}

async function confirmSave() {
  if (!saveForm.value.name.trim()) return
  try {
    await addScript(
      saveForm.value.name,
      pendingSaveCode.value,
      saveForm.value.description,
      saveForm.value.urlPattern || '*',
    )
    showSaveDialog.value = false
    emit('save-script')
  } catch (e) {
    console.error('保存脚本失败:', e)
    alert('保存失败: ' + (e instanceof Error ? e.message : String(e)))
  }
}

function renderStream(text: string): string {
  return text.replace(/\n/g, '<br/>')
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

watch([messages, streamContent], scrollToBottom, { deep: true })
</script>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.empty-state .hint {
  font-size: 12px;
  margin-top: 8px;
  color: #bbb;
}

.streaming .cursor {
  animation: blink 1s infinite;
  color: #6c5ce7;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.message-bubble.assistant .bubble-content {
  padding: 10px 14px;
  border-radius: 12px;
  background: white;
  border: 1px solid #e0e0e0;
  border-bottom-left-radius: 4px;
  line-height: 1.6;
  word-break: break-word;
}

.loading-indicator {
  display: flex;
  gap: 4px;
  padding: 10px 20px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6c5ce7;
  animation: bounce 1.4s infinite both;
}

.dot:nth-child(2) { animation-delay: 0.16s; }
.dot:nth-child(3) { animation-delay: 0.32s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.exec-result {
  margin: 8px 0;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
}

.exec-result.success {
  background: #e8f5e9;
  border: 1px solid #a5d6a7;
}

.exec-result.error {
  background: #fce4ec;
  border: 1px solid #ef9a9a;
}

.exec-result p {
  margin-top: 4px;
  color: #555;
}

.input-area {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-top: 1px solid #e0e0e0;
  background: white;
  flex-shrink: 0;
}

.input-row {
  display: flex;
  gap: 8px;
}

.input-area textarea {
  flex: 1;
  resize: none;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 8px 10px;
  outline: none;
  transition: border-color 0.2s;
}

.input-area textarea:focus {
  border-color: #6c5ce7;
}

.send-btn {
  padding: 8px 16px;
  background: #6c5ce7;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  transition: background 0.2s;
  align-self: flex-end;
}

.send-btn:hover:not(:disabled) {
  background: #5b4bd5;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stop-btn {
  padding: 8px 16px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  transition: background 0.2s;
  align-self: flex-end;
  cursor: pointer;
}

.stop-btn:hover {
  background: #c0392b;
}

.clear-btn {
  background: none;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  color: #999;
  cursor: pointer;
  align-self: flex-start;
  transition: all 0.2s;
}

.clear-btn:hover:not(:disabled) {
  color: #e74c3c;
  border-color: #e74c3c;
}

.clear-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Save Dialog */
.save-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.save-dialog {
  background: white;
  border-radius: 12px;
  padding: 20px;
  width: 280px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}

.save-dialog h3 {
  margin-bottom: 14px;
  font-size: 16px;
  color: #1a1a1a;
}

.save-field {
  margin-bottom: 10px;
}

.save-field label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #555;
}

.save-field input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  outline: none;
  box-sizing: border-box;
}

.save-field input:focus {
  border-color: #6c5ce7;
}

.save-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.save-btn-cancel,
.save-btn-confirm {
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.save-btn-cancel {
  background: #eee;
  color: #555;
}

.save-btn-confirm {
  background: #6c5ce7;
  color: white;
}

.save-btn-confirm:hover {
  background: #5b4bd5;
}
</style>
