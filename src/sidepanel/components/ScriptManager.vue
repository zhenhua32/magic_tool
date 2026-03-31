<template>
  <div class="script-manager">
    <div v-if="scripts.length === 0" class="empty-state">
      <p>📜 暂无保存的脚本</p>
      <p class="hint">在对话中生成代码后，点击 💾 保存即可</p>
    </div>

    <div v-for="script in scripts" :key="script.id" class="script-card">
      <div class="script-header">
        <div class="script-info">
          <strong>{{ script.name }}</strong>
          <span v-if="script.description" class="description">{{ script.description }}</span>
          <span class="meta">{{ script.urlPattern }} · {{ formatDate(script.updatedAt) }}</span>
        </div>
        <div class="script-actions">
          <button class="action-btn run" @click="run(script)" title="执行">▶</button>
          <button class="action-btn edit" @click="toggleEdit(script.id)" title="编辑">✏️</button>
          <button class="action-btn delete" @click="remove(script.id)" title="删除">🗑️</button>
        </div>
      </div>

      <!-- Edit mode -->
      <div v-if="editingId === script.id" class="edit-section">
        <div class="field">
          <label>名称</label>
          <input v-model="editForm.name" />
        </div>
        <div class="field">
          <label>URL 匹配</label>
          <input v-model="editForm.urlPattern" />
        </div>
        <div class="field">
          <label>代码</label>
          <textarea v-model="editForm.code" rows="6"></textarea>
        </div>
        <div class="edit-actions">
          <button class="btn cancel" @click="editingId = ''">取消</button>
          <button class="btn confirm" @click="saveEdit(script.id)">保存</button>
        </div>
      </div>

      <!-- Code preview (collapsed) -->
      <pre v-else class="code-preview"><code>{{ script.code.slice(0, 120) }}{{ script.code.length > 120 ? '...' : '' }}</code></pre>

      <!-- Execution result -->
      <div v-if="results[script.id]" class="exec-result" :class="{ success: results[script.id].success, error: !results[script.id].success }">
        {{ results[script.id].success ? '✅ ' + results[script.id].result : '❌ ' + results[script.id].error }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import type { SavedScript } from '@/shared/types'
import { useScripts } from '../composables/useScripts'

const { scripts, removeScript, updateScript, executeScript } = useScripts()

const editingId = ref('')
const editForm = reactive({ name: '', urlPattern: '', code: '' })
const results = reactive<Record<string, { success: boolean; result?: string; error?: string }>>({})

function toggleEdit(id: string) {
  if (editingId.value === id) {
    editingId.value = ''
    return
  }
  const s = scripts.value.find((x) => x.id === id)
  if (s) {
    editForm.name = s.name
    editForm.urlPattern = s.urlPattern
    editForm.code = s.code
    editingId.value = id
  }
}

async function saveEdit(id: string) {
  await updateScript(id, {
    name: editForm.name,
    urlPattern: editForm.urlPattern,
    code: editForm.code,
  })
  editingId.value = ''
}

async function remove(id: string) {
  await removeScript(id)
  delete results[id]
}

async function run(script: SavedScript) {
  delete results[script.id]
  const res = await executeScript(script.code)
  results[script.id] = res
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped>
.script-manager {
  padding: 12px;
  overflow-y: auto;
  flex: 1;
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

.script-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  margin-bottom: 10px;
  overflow: hidden;
}

.script-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 10px 12px;
}

.script-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.script-info strong {
  font-size: 14px;
}

.description {
  font-size: 12px;
  color: #666;
}

.meta {
  font-size: 11px;
  color: #aaa;
}

.script-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  padding: 2px 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #f5f5f5;
}

.action-btn.run:hover {
  background: #e8f5e9;
  border-color: #a5d6a7;
}

.action-btn.delete:hover {
  background: #fce4ec;
  border-color: #ef9a9a;
}

.code-preview {
  margin: 0;
  padding: 8px 12px;
  background: #f8f8f8;
  font-size: 11px;
  color: #666;
  border-top: 1px solid #f0f0f0;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: 'Fira Code', 'Consolas', monospace;
}

.edit-section {
  padding: 10px 12px;
  border-top: 1px solid #f0f0f0;
  background: #fafafa;
}

.edit-section .field {
  margin-bottom: 8px;
}

.edit-section label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 2px;
  color: #555;
}

.edit-section input,
.edit-section textarea {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  outline: none;
  font-family: inherit;
}

.edit-section textarea {
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  resize: vertical;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 8px;
}

.btn {
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.btn.cancel { background: #eee; color: #555; }
.btn.confirm { background: #6c5ce7; color: white; }

.exec-result {
  padding: 8px 12px;
  font-size: 12px;
  border-top: 1px solid #f0f0f0;
}

.exec-result.success { background: #e8f5e9; }
.exec-result.error { background: #fce4ec; }
</style>
