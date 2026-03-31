import { ref } from 'vue'
import type { SavedScript } from '@/shared/types'
import { getScripts, saveScripts, generateId } from '@/shared/storage'

// Singleton shared state
const scripts = ref<SavedScript[]>([])
let initialized = false

async function loadScripts() {
  scripts.value = await getScripts()
}

// Auto-sync when storage changes (e.g. from another component or background)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.scripts) {
    const newVal = changes.scripts.newValue
    scripts.value = Array.isArray(newVal) ? newVal : []
  }
})

export function useScripts() {
  if (!initialized) {
    initialized = true
    loadScripts()
  }

  async function addScript(
    name: string,
    code: string,
    description: string = '',
    urlPattern: string = '*',
  ) {
    const script: SavedScript = {
      id: generateId(),
      name,
      code,
      urlPattern,
      description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    scripts.value = [...scripts.value, script]
    await saveScripts(scripts.value)
    return script
  }

  async function removeScript(id: string) {
    scripts.value = scripts.value.filter((s) => s.id !== id)
    await saveScripts(scripts.value)
  }

  async function updateScript(id: string, updates: Partial<SavedScript>) {
    const idx = scripts.value.findIndex((s) => s.id === id)
    if (idx !== -1) {
      const updated = [...scripts.value]
      updated[idx] = {
        ...updated[idx],
        ...updates,
        updatedAt: Date.now(),
      }
      scripts.value = updated
      await saveScripts(scripts.value)
    }
  }

  async function executeScript(code: string): Promise<{ success: boolean; result?: string; error?: string }> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'EXECUTE_CODE', data: { code } },
        (res) => resolve(res ?? { success: false, error: '无响应' }),
      )
    })
  }

  return { scripts, addScript, removeScript, updateScript, executeScript }
}
