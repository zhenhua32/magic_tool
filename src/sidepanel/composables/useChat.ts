import { ref } from 'vue'
import type { ChatMessage } from '@/shared/types'
import { generateId } from '@/shared/storage'

const MAX_RETRIES = 2

export function useChat() {
  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)
  const streamContent = ref('')
  const retryCount = ref(0)

  function addMessage(role: ChatMessage['role'], content: string, code?: string): ChatMessage {
    const msg: ChatMessage = {
      id: generateId(),
      role,
      content,
      code,
      timestamp: Date.now(),
    }
    messages.value = [...messages.value, msg]
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
    // Support ```javascript, ```js, ```typescript, ```ts
    const match = text.match(/```(?:javascript|js|typescript|ts)\s*\n([\s\S]*?)\n```/)
    return match?.[1]?.trim()
  }

  /** Execute code and auto-retry with AI on failure (called on manual execute) */
  async function executeAndRetry(code: string): Promise<{ success: boolean; result?: string; error?: string }> {
    retryCount.value = 0
    return await doExecuteWithRetry(code)
  }

  async function doExecuteWithRetry(code: string): Promise<{ success: boolean; result?: string; error?: string }> {
    const execResult = await executeCode(code)

    if (execResult.success) {
      addMessage('system', `✅ 执行成功: ${execResult.result ?? 'done'}`)
      retryCount.value = 0
      return execResult
    }

    // Execution failed
    addMessage('system', `❌ 执行失败: ${execResult.error}`)

    if (retryCount.value >= MAX_RETRIES) {
      addMessage('system', `⚠️ 已达到最大重试次数 (${MAX_RETRIES})，请检查需求描述或手动调整代码`)
      retryCount.value = 0
      return execResult
    }

    retryCount.value++
    const retryMessage = `代码执行失败，错误信息: ${execResult.error}\n请根据错误信息修正代码。`
    addMessage('user', retryMessage)

    // Re-fetch HTML and ask AI to fix
    isLoading.value = true
    try {
      const freshHtml = await getPageHTML()
      const settingsResult = await chrome.storage.local.get('settings')
      const settings = settingsResult.settings
      let screenshot: string | undefined
      if (settings?.modelType === 'vision') {
        screenshot = await captureScreenshot()
      }
      await callAIWithHistory(retryMessage, freshHtml, screenshot)

      // Find the latest assistant message with code
      const lastAssistant = [...messages.value].reverse().find(m => m.role === 'assistant' && m.code)
      if (lastAssistant?.code) {
        return await doExecuteWithRetry(lastAssistant.code)
      }
    } finally {
      isLoading.value = false
    }

    retryCount.value = 0
    return execResult
  }

  /** Core AI call that sends conversation history */
  async function callAIWithHistory(
    userMessage: string,
    html: string,
    screenshot: string | undefined,
    useStream: boolean = true,
  ) {
    // Build history from messages (exclude the last user message which we just added)
    const history = messages.value.slice()

    if (useStream) {
      await callAIStream(userMessage, html, screenshot, history)
    } else {
      await callAINonStream(userMessage, html, screenshot, history)
    }
  }

  async function callAIStream(
    userMessage: string,
    html: string,
    screenshot: string | undefined,
    history: ChatMessage[],
  ) {
    return new Promise<void>((resolve) => {
      const streamListener = (msg: any) => {
        if (msg.type === 'AI_CHAT_STREAM_CHUNK') {
          streamContent.value += msg.data
        } else if (msg.type === 'AI_CHAT_STREAM_DONE') {
          chrome.runtime.onMessage.removeListener(streamListener)
          currentStreamListener = null
          const content = streamContent.value
          const code = extractCode(content)
          addMessage('assistant', content, code)
          streamContent.value = ''
          isLoading.value = false
          resolve()
        } else if (msg.type === 'AI_CHAT_STREAM_ERROR') {
          chrome.runtime.onMessage.removeListener(streamListener)
          currentStreamListener = null
          addMessage('assistant', `❌ 错误: ${msg.data}`)
          streamContent.value = ''
          isLoading.value = false
          resolve()
        }
      }

      currentStreamListener = streamListener
      chrome.runtime.onMessage.addListener(streamListener)
      streamContent.value = ''
      chrome.runtime.sendMessage({
        type: 'AI_CHAT_STREAM',
        data: { userMessage, html, screenshot, history },
      })
    })
  }

  async function callAINonStream(
    userMessage: string,
    html: string,
    screenshot: string | undefined,
    history: ChatMessage[],
  ) {
    const result = await new Promise<any>((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'AI_CHAT',
          data: { userMessage, html, screenshot, history },
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
  }

  async function sendMessage(userText: string, useStream: boolean = true) {
    if (!userText.trim() || isLoading.value) return

    addMessage('user', userText)
    isLoading.value = true
    streamContent.value = ''
    retryCount.value = 0

    try {
      const html = await getPageHTML()

      // Check settings for vision model
      const settingsResult = await chrome.storage.local.get('settings')
      const settings = settingsResult.settings
      let screenshot: string | undefined
      if (settings?.modelType === 'vision') {
        screenshot = await captureScreenshot()
      }

      await callAIWithHistory(userText, html, screenshot, useStream)
    } catch (e: any) {
      addMessage('assistant', `❌ 错误: ${e.message}`)
      isLoading.value = false
    }
  }

  let currentStreamListener: ((msg: any) => void) | null = null

  function stopGeneration() {
    // Remove stream listener
    if (currentStreamListener) {
      chrome.runtime.onMessage.removeListener(currentStreamListener)
      currentStreamListener = null
    }
    // Tell background to abort fetch
    chrome.runtime.sendMessage({ type: 'ABORT_STREAM' })
    // Save whatever we have so far
    if (streamContent.value) {
      const content = streamContent.value
      const code = extractCode(content)
      addMessage('assistant', content + '\n\n⏹️ *已手动停止*', code)
    }
    streamContent.value = ''
    isLoading.value = false
    retryCount.value = 0
  }

  function clearMessages() {
    messages.value = []
    streamContent.value = ''
    retryCount.value = 0
  }

  return {
    messages,
    isLoading,
    streamContent,
    retryCount,
    sendMessage,
    executeCode,
    executeAndRetry,
    extractCode,
    addMessage,
    clearMessages,
    stopGeneration,
  }
}
