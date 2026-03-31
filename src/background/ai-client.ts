import type { Settings } from '@/shared/types'

interface ChatCompletionMessage {
  role: string
  content: any
}

interface ChatCompletionRequest {
  model: string
  messages: ChatCompletionMessage[]
  stream?: boolean
}

export async function callAI(
  settings: Settings,
  messages: ChatCompletionMessage[],
): Promise<string> {
  const url = `${settings.apiBaseUrl.replace(/\/+$/, '')}/chat/completions`

  const body: ChatCompletionRequest = {
    model: settings.modelName,
    messages,
    stream: false,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AI API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content ?? ''
}

export async function callAIStream(
  settings: Settings,
  messages: ChatCompletionMessage[],
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
): Promise<void> {
  const url = `${settings.apiBaseUrl.replace(/\/+$/, '')}/chat/completions`

  const body: ChatCompletionRequest = {
    model: settings.modelName,
    messages,
    stream: true,
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
    })
  } catch (e: any) {
    onError(e.message || 'Network error')
    return
  }

  if (!response.ok) {
    const errorText = await response.text()
    onError(`AI API error (${response.status}): ${errorText}`)
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    onError('No response body')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') {
        onDone()
        return
      }
      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta?.content
        if (delta) onChunk(delta)
      } catch {
        // skip malformed JSON
      }
    }
  }
  onDone()
}
