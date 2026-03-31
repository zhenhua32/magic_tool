import { ref, onMounted } from 'vue'
import type { SavedScript } from '@/shared/types'
import { getScripts, saveScripts, generateId } from '@/shared/storage'

export function useScripts() {
  const scripts = ref<SavedScript[]>([])

  onMounted(async () => {
    scripts.value = await getScripts()
  })

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
    scripts.value.push(script)
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
      scripts.value[idx] = {
        ...scripts.value[idx],
        ...updates,
        updatedAt: Date.now(),
      }
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
