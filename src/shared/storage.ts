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
  return Array.isArray(result.scripts) ? result.scripts : []
}

export async function saveScripts(scripts: SavedScript[]): Promise<void> {
  // Strip Vue reactive proxy to ensure chrome.storage can serialize correctly
  const raw = JSON.parse(JSON.stringify(scripts))
  await chrome.storage.local.set({ scripts: raw })
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
