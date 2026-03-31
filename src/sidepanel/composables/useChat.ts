import { ref } from 'vue'
import type { ChatMessage } from '@/shared/types'
import { generateId } from '@/shared/storage'

export function useChat() {
  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)
  const streamContent = ref('')

  function addMessage(role: ChatMessage['role'], content: string, code?: string): ChatMessage {
    const msg: ChatMessage = {
      id: generateId(),
      role,
      content,
      code,
      timestamp: Date.now(),
    }
    messages.value.push(msg)
    return msg
  }

  async function getPageHTML(): Promise<string> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_HTML' }, (res) => {
        resolve(res?.success ? res.data : '<p>无法获取页面内容</p>')
      })
    })
  }

  async function captureScreenshot(): Promise<string | undefined> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (res) => {
        resolve(res?.success ? res.data : undefined)
      })
    })
  }

  async function executeCode(code: string): Promise<{ success: boolean; result?: string; error?: string }> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'EXECUTE_CODE', data: { code } },
        (res) => resolve(res ?? { success: false, error: '无响应' }),
      )
    })
  }

  function extractCode(text: string): string | undefined {
    const match = text.match(/```javascript\s*\n([\s\S]*?)\n```/)
    return match?.[1]?.trim()
  }

  async function sendMessage(userText: string, useStream: boolean = true) {
    if (!userText.trim() || isLoading.value) return

    addMessage('user', userText)
    isLoading.value = true
    streamContent.value = ''

    try {
      const html = await getPageHTML()

      // Check settings for vision model
      const settingsResult = await chrome.storage.local.get('settings')
      const settings = settingsResult.settings
      let screenshot: string | undefined
      if (settings?.modelType === 'vision') {
        screenshot = await captureScreenshot()
      }

      if (useStream) {
        // Stream mode
        const streamListener = (msg: any) => {
          if (msg.type === 'AI_CHAT_STREAM_CHUNK') {
            streamContent.value += msg.data
          } else if (msg.type === 'AI_CHAT_STREAM_DONE') {
            chrome.runtime.onMessage.removeListener(streamListener)
            const content = streamContent.value
            const code = extractCode(content)
            addMessage('assistant', content, code)
            streamContent.value = ''
            isLoading.value = false
          } else if (msg.type === 'AI_CHAT_STREAM_ERROR') {
            chrome.runtime.onMessage.removeListener(streamListener)
            addMessage('assistant', `❌ 错误: ${msg.data}`)
            streamContent.value = ''
            isLoading.value = false
          }
        }

        chrome.runtime.onMessage.addListener(streamListener)
        chrome.runtime.sendMessage({
          type: 'AI_CHAT_STREAM',
          data: { userMessage: userText, html, screenshot },
        })
      } else {
        // Non-stream mode
        const result = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'AI_CHAT',
              data: { userMessage: userText, html, screenshot },
            },
            resolve,
          )
        })

        if (result?.success) {
          const code = extractCode(result.data)
          addMessage('assistant', result.data, code)
        } else {
          addMessage('assistant', `❌ 错误: ${result?.error ?? '未知错误'}`)
        }
        isLoading.value = false
      }
    } catch (e: any) {
      addMessage('assistant', `❌ 错误: ${e.message}`)
      isLoading.value = false
    }
  }

  return {
    messages,
    isLoading,
    streamContent,
    sendMessage,
    executeCode,
    extractCode,
    addMessage,
  }
}
