import { ref, onMounted } from 'vue'
import type { Settings } from '@/shared/types'
import { DEFAULT_SETTINGS } from '@/shared/types'
import { getSettings, saveSettings } from '@/shared/storage'

export function useSettings() {
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS })
  const loading = ref(true)

  onMounted(async () => {
    settings.value = await getSettings()
    loading.value = false
  })

  async function save() {
    await saveSettings(settings.value)
  }

  return { settings, loading, save }
}
