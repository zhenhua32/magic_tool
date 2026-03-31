import type { Settings } from '@/shared/types'
import { DEFAULT_SYSTEM_PROMPT } from '@/shared/types'

export function buildMessages(
  settings: Settings,
  userMessage: string,
  html: string,
  screenshot?: string,
): { role: string; content: any }[] {
  const systemPrompt = settings.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT
  const messages: { role: string; content: any }[] = [
    { role: 'system', content: systemPrompt },
  ]

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
