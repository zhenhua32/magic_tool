<template>
  <div class="settings-panel">
    <div v-if="loading" class="loading">加载中...</div>
    <template v-else>
      <div class="field">
        <label>API Base URL</label>
        <input
          v-model="settings.apiBaseUrl"
          type="url"
          placeholder="https://api.openai.com/v1"
          @change="save"
        />
      </div>

      <div class="field">
        <label>API Key</label>
        <input
          v-model="settings.apiKey"
          type="password"
          placeholder="sk-..."
          @change="save"
        />
      </div>

      <div class="field">
        <label>模型类型</label>
        <select v-model="settings.modelType" @change="save">
          <option value="text">文本模型</option>
          <option value="vision">视觉模型（含截图）</option>
        </select>
      </div>

      <div class="field">
        <label>模型名称</label>
        <input
          v-model="settings.modelName"
          type="text"
          placeholder="gpt-4o"
          @change="save"
        />
      </div>

      <div class="test-section">
        <button
          class="test-btn"
          :class="{ 'testing': testing, 'success': testResult === 'success', 'fail': testResult === 'fail' }"
          :disabled="testing || !settings.apiKey"
          @click="testConnection"
        >
          <span v-if="testing">测试中...</span>
          <span v-else-if="testResult === 'success'">✅ 连接成功</span>
          <span v-else-if="testResult === 'fail'">❌ 连接失败</span>
          <span v-else>🔗 测试连接</span>
        </button>
        <p v-if="testError" class="test-error">{{ testError }}</p>
      </div>

      <div class="field">
        <label>
          系统 Prompt
          <button class="reset-btn" @click="resetPrompt">恢复默认</button>
        </label>
        <textarea
          v-model="settings.systemPrompt"
          rows="12"
          placeholder="自定义系统 Prompt..."
          @change="save"
        ></textarea>
      </div>

      <div class="hint">
        <p>💡 视觉模型会额外发送当前页面截图，有助于识别元素位置。</p>
        <p>💡 API Key 仅保存在本地，不会同步到其他设备。</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSettings } from '../composables/useSettings'
import { DEFAULT_SYSTEM_PROMPT } from '@/shared/types'

const { settings, loading, save } = useSettings()

function resetPrompt() {
  settings.value.systemPrompt = DEFAULT_SYSTEM_PROMPT
  save()
}

const testing = ref(false)
const testResult = ref<'success' | 'fail' | null>(null)
const testError = ref('')

async function testConnection() {
  await save()
  testing.value = true
  testResult.value = null
  testError.value = ''

  try {
    const url = `${settings.value.apiBaseUrl.replace(/\/+$/, '')}/chat/completions`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.value.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.value.modelName,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      }),
    })

    if (res.ok) {
      testResult.value = 'success'
    } else {
      const data = await res.json().catch(() => null)
      testResult.value = 'fail'
      testError.value = data?.error?.message || `HTTP ${res.status}: ${res.statusText}`
    }
  } catch (e: any) {
    testResult.value = 'fail'
    testError.value = e.message || '网络请求失败'
  } finally {
    testing.value = false
    setTimeout(() => { testResult.value = null; testError.value = '' }, 5000)
  }
}
</script>

<style scoped>
.settings-panel {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

.field {
  margin-bottom: 16px;
}

.field label {
  display: block;
  font-weight: 600;
  margin-bottom: 4px;
  color: #333;
}

.field textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  outline: none;
  transition: border-color 0.2s;
  resize: vertical;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
  min-height: 120px;
}

.field textarea:focus {
  border-color: #6c5ce7;
}

.reset-btn {
  float: right;
  font-size: 12px;
  color: #6c5ce7;
  background: none;
  border: none;
  cursor: pointer;
  font-weight: normal;
}

.reset-btn:hover {
  text-decoration: underline;
}

.field input,
.field select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  outline: none;
  transition: border-color 0.2s;
}

.field input:focus,
.field select:focus {
  border-color: #6c5ce7;
}

.hint {
  margin-top: 20px;
  padding: 10px;
  background: #f0f0f0;
  border-radius: 6px;
  font-size: 12px;
  color: #666;
  line-height: 1.6;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #999;
}

.test-section {
  margin-bottom: 16px;
}

.test-btn {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 6px;
  background: #6c5ce7;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.test-btn:hover:not(:disabled) {
  background: #5a4bd1;
}

.test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.test-btn.testing {
  background: #a29bfe;
}

.test-btn.success {
  background: #00b894;
}

.test-btn.fail {
  background: #d63031;
}

.test-error {
  margin-top: 6px;
  font-size: 12px;
  color: #d63031;
  word-break: break-all;
}
</style>
