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

      <div class="hint">
        <p>💡 视觉模型会额外发送当前页面截图，有助于识别元素位置。</p>
        <p>💡 API Key 仅保存在本地，不会同步到其他设备。</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useSettings } from '../composables/useSettings'

const { settings, loading, save } = useSettings()
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
</style>
