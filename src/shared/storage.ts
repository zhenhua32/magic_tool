import type { Settings, SavedScript } from './types'
import { DEFAULT_SETTINGS } from './types'

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings')
  return { ...DEFAULT_SETTINGS, ...result.settings }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings })
}

export async function getScripts(): Promise<SavedScript[]> {
  const result = await chrome.storage.local.get('scripts')
  return result.scripts || []
}

export async function saveScripts(scripts: SavedScript[]): Promise<void> {
  await chrome.storage.local.set({ scripts })
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
