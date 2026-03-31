import type { ExtMessage, ExecuteResult } from '@/shared/types'
import { getSettings } from '@/shared/storage'
import { callAI, callAIStream } from './ai-client'
import { buildMessages } from './prompt-builder'

// Open side panel on action click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error)

// Message routing
chrome.runtime.onMessage.addListener(
  (message: ExtMessage, sender, sendResponse) => {
    const handler = messageHandlers[message.type]
    if (handler) {
      handler(message, sender, sendResponse)
      return true // keep channel open for async
    }
    return false
  },
)

const messageHandlers: Record<
  string,
  (msg: ExtMessage, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void
> = {
  CAPTURE_SCREENSHOT: async (_msg, _sender, sendResponse) => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })
      if (!tab?.id) {
        sendResponse({ success: false, error: 'No active tab' })
        return
      }
      const dataUrl = await chrome.tabs.captureVisibleTab(
        tab.windowId,
        { format: 'png' },
      )
      sendResponse({ success: true, data: dataUrl })
    } catch (e: any) {
      sendResponse({ success: false, error: e.message })
    }
  },

  GET_HTML: async (_msg, _sender, sendResponse) => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })
      if (!tab?.id) {
        sendResponse({ success: false, error: 'No active tab' })
        return
      }
      const results = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_HTML',
      })
      sendResponse(results)
    } catch (e: any) {
      sendResponse({ success: false, error: e.message })
    }
  },

  EXECUTE_CODE: async (msg, _sender, sendResponse) => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })
      if (!tab?.id) {
        sendResponse({ success: false, error: 'No active tab' })
        return
      }
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (code: string) => {
          try {
            const indirectEval = (0, eval)
            const result = indirectEval(code)
            return { success: true, result: String(result ?? 'done') }
          } catch (e: any) {
            return { success: false, error: e.message }
          }
        },
        args: [msg.data.code],
        world: 'MAIN',
      })
      const execResult: ExecuteResult = results[0]?.result ?? {
        success: false,
        error: 'No result',
      }
      sendResponse(execResult)
    } catch (e: any) {
      sendResponse({ success: false, error: e.message })
    }
  },

  AI_CHAT: async (msg, _sender, sendResponse) => {
    try {
      const settings = await getSettings()
      if (!settings.apiKey) {
        sendResponse({ success: false, error: '请先配置 API Key' })
        return
      }
      const { userMessage, html, screenshot } = msg.data
      const messages = buildMessages(settings, userMessage, html, screenshot)
      const reply = await callAI(settings, messages)
      sendResponse({ success: true, data: reply })
    } catch (e: any) {
      sendResponse({ success: false, error: e.message })
    }
  },

  AI_CHAT_STREAM: async (msg, _sender, _sendResponse) => {
    try {
      const settings = await getSettings()
      if (!settings.apiKey) {
        chrome.runtime.sendMessage({
          type: 'AI_CHAT_STREAM_ERROR',
          data: '请先配置 API Key',
        })
        return
      }
      const { userMessage, html, screenshot } = msg.data
      const messages = buildMessages(settings, userMessage, html, screenshot)

      await callAIStream(
        settings,
        messages,
        (chunk) => {
          chrome.runtime.sendMessage({
            type: 'AI_CHAT_STREAM_CHUNK',
            data: chunk,
          })
        },
        () => {
          chrome.runtime.sendMessage({ type: 'AI_CHAT_STREAM_DONE' })
        },
        (error) => {
          chrome.runtime.sendMessage({
            type: 'AI_CHAT_STREAM_ERROR',
            data: error,
          })
        },
      )
    } catch (e: any) {
      chrome.runtime.sendMessage({
        type: 'AI_CHAT_STREAM_ERROR',
        data: e.message,
      })
    }
  },
}
