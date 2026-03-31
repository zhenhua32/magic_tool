<template>
  <div class="app">
    <header class="app-header">
      <h1>🪄 魔法自动化</h1>
      <div class="header-actions">
        <button
          class="icon-btn"
          :class="{ active: currentTab === 'chat' }"
          @click="currentTab = 'chat'"
          title="对话"
        >💬</button>
        <button
          class="icon-btn"
          :class="{ active: currentTab === 'scripts' }"
          @click="currentTab = 'scripts'"
          title="脚本"
        >📜</button>
        <button
          class="icon-btn"
          :class="{ active: currentTab === 'settings' }"
          @click="currentTab = 'settings'"
          title="设置"
        >⚙️</button>
      </div>
    </header>
    <main class="app-main">
      <ChatPanel v-if="currentTab === 'chat'" @save-script="handleSaveScript" />
      <ScriptManager v-else-if="currentTab === 'scripts'" />
      <SettingsPanel v-else-if="currentTab === 'settings'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ChatPanel from './components/ChatPanel.vue'
import ScriptManager from './components/ScriptManager.vue'
import SettingsPanel from './components/SettingsPanel.vue'

const currentTab = ref<'chat' | 'scripts' | 'settings'>('chat')

function handleSaveScript() {
  currentTab.value = 'scripts'
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: #1a1a1a;
  background: #f5f5f5;
  width: 100%;
  min-height: 100vh;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #6c5ce7;
  color: white;
  flex-shrink: 0;
}

.app-header h1 {
  font-size: 16px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.icon-btn {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: rgba(255,255,255,0.2);
}

.icon-btn.active {
  background: rgba(255,255,255,0.3);
  border-color: rgba(255,255,255,0.6);
}

.app-main {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

button {
  cursor: pointer;
}

input, textarea, select {
  font-family: inherit;
  font-size: inherit;
}
</style>
