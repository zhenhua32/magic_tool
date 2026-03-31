<template>
  <div class="code-block">
    <div class="code-header">
      <span>JavaScript</span>
      <div class="code-actions">
        <button class="action-btn run" @click="$emit('execute')" title="执行代码">▶ 执行</button>
        <button class="action-btn save" @click="$emit('save')" title="保存脚本">💾 保存</button>
      </div>
    </div>
    <pre><code>{{ code }}</code></pre>
  </div>
</template>

<script setup lang="ts">
defineProps<{ code: string }>()
defineEmits<{
  execute: []
  save: []
}>()
</script>

<style scoped>
.code-block {
  margin-top: 8px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e0e0e0;
  background: #1e1e1e;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: #2d2d2d;
  color: #aaa;
  font-size: 12px;
}

.code-actions {
  display: flex;
  gap: 6px;
}

.action-btn {
  padding: 2px 10px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.action-btn.run {
  background: #27ae60;
  color: white;
}

.action-btn.run:hover {
  background: #219a52;
}

.action-btn.save {
  background: #3498db;
  color: white;
}

.action-btn.save:hover {
  background: #2980b9;
}

pre {
  margin: 0;
  padding: 12px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.5;
  color: #d4d4d4;
  font-family: 'Fira Code', 'Consolas', monospace;
}
</style>
