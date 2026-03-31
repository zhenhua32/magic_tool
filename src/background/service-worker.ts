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
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const MAX_HTML_LENGTH = 50000
          const MAX_DEPTH = 10
          const SKIP_TAGS = new Set([
            'SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'LINK', 'META',
          ])
          const KEEP_ATTRS = new Set([
            'id', 'class', 'name', 'type', 'value', 'href', 'src', 'alt',
            'title', 'placeholder', 'role', 'aria-label', 'for', 'action',
            'method', 'data-testid', 'data-id',
          ])
          function extractNode(node: Node, depth: number): string {
            if (depth > MAX_DEPTH) return ''
            if (node.nodeType === Node.TEXT_NODE) {
              const text = node.textContent?.trim() ?? ''
              return text ? text.slice(0, 200) : ''
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return ''
            const el = node as Element
            if (SKIP_TAGS.has(el.tagName)) return ''
            const tag = el.tagName.toLowerCase()
            const attrs: string[] = []
            for (const attr of el.attributes) {
              if (KEEP_ATTRS.has(attr.name)) {
                attrs.push(`${attr.name}="${attr.value.slice(0, 100)}"`)
              }
            }
            const attrStr = attrs.length ? ' ' + attrs.join(' ') : ''
            const children = Array.from(el.childNodes)
              .map((child) => extractNode(child, depth + 1))
              .filter(Boolean)
              .join('\n')
            if (!children && !attrs.length && el.childNodes.length === 0) return ''
            return `<${tag}${attrStr}>${children ? '\n' + children + '\n' : ''}</${tag}>`
          }
          let html = extractNode(document.body, 0)
          if (html.length > MAX_HTML_LENGTH) {
            html = html.slice(0, MAX_HTML_LENGTH) + '\n<!-- truncated -->'
          }
          return html
        },
        world: 'MAIN',
      })
      const html = results[0]?.result ?? ''
      sendResponse({ success: true, data: html })
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
