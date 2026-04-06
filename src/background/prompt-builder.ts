import type { Settings, ChatMessage } from '@/shared/types'
import { DEFAULT_SYSTEM_PROMPT } from '@/shared/types'

const MAX_HISTORY_MESSAGES = 20

export function buildMessages(
  settings: Settings,
  userMessage: string,
  html: string,
  screenshot?: string,
  history?: ChatMessage[],
): { role: string; content: any }[] {
  const systemPrompt = settings.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT
  const messages: { role: string; content: any }[] = [
    { role: 'system', content: systemPrompt },
  ]

  // Append conversation history (excluding the current user message which is the last one)
  if (history && history.length > 0) {
    // Keep only recent messages to stay within token budget
    const trimmed = history.length > MAX_HISTORY_MESSAGES
      ? history.slice(-MAX_HISTORY_MESSAGES)
      : history
    for (const msg of trimmed) {
      // Skip the last user message — it will be added below with HTML context
      if (msg === history[history.length - 1] && msg.role === 'user') continue
      messages.push({
        role: msg.role === 'system' ? 'user' : msg.role,
        content: msg.content,
      })
    }
  }

  if (settings.modelType === 'vision' && screenshot) {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: `当前网页 HTML（已精简）:\n\n${html}\n\n用户操作需求: ${userMessage}`,
        },
        {
          type: 'image_url',
          image_url: {
            url: screenshot.startsWith('data:')
              ? screenshot
              : `data:image/png;base64,${screenshot}`,
          },
        },
      ],
    })
  } else {
    messages.push({
      role: 'user',
      content: `当前网页 HTML（已精简）:\n\n${html}\n\n用户操作需求: ${userMessage}`,
    })
  }

  return messages
}
