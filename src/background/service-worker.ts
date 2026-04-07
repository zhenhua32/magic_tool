import type { ExtMessage, ExecuteResult } from '@/shared/types'
import { getSettings } from '@/shared/storage'
import { callAI, callAIStream } from './ai-client'
import { buildMessages, buildAgentMessages, buildAgentFeedbackMessage } from './prompt-builder'

// Open side panel on action click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error)

// Handlers that use sendResponse asynchronously (need return true)
const asyncHandlers = new Set(['CAPTURE_SCREENSHOT', 'GET_HTML', 'EXECUTE_CODE', 'AI_CHAT', 'ABORT_STREAM', 'WAIT_FOR_STABLE', 'AI_CHAT_AGENT'])

// AbortController for current stream
let currentStreamAbort: AbortController | null = null

// Message routing
chrome.runtime.onMessage.addListener(
  (message: ExtMessage, sender, sendResponse) => {
    const handler = messageHandlers[message.type]
    if (handler) {
      handler(message, sender, sendResponse)
      return asyncHandlers.has(message.type) // only keep channel open for handlers that call sendResponse
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
            'disabled', 'checked', 'selected', 'readonly', 'required',
            'aria-disabled', 'aria-hidden', 'aria-expanded',
          ])
          const INTERACTIVE_TAGS = new Set([
            'A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL',
            'DETAILS', 'SUMMARY',
          ])
          function isElementVisible(el: Element): boolean {
            const style = window.getComputedStyle(el)
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
            const rect = el.getBoundingClientRect()
            return rect.width > 0 && rect.height > 0
          }
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
            if (INTERACTIVE_TAGS.has(el.tagName) || el.getAttribute('role') === 'button' || el.getAttribute('onclick')) {
              const visible = isElementVisible(el)
              attrs.push(`data-visible="${visible}"`)
              if ((el as HTMLButtonElement).disabled) {
                if (!attrs.some(a => a.startsWith('disabled'))) {
                  attrs.push('disabled="true"')
                }
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
      const EXEC_TIMEOUT = 30000
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('代码执行超时（30秒）')), EXEC_TIMEOUT),
      )
      const execPromise = chrome.scripting.executeScript({
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
      const results = await Promise.race([execPromise, timeoutPromise])
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
      const { userMessage, html, screenshot, history } = msg.data
      const messages = buildMessages(settings, userMessage, html, screenshot, history)
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
      const { userMessage, html, screenshot, history } = msg.data
      const messages = buildMessages(settings, userMessage, html, screenshot, history)

      currentStreamAbort = new AbortController()
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
          currentStreamAbort = null
          chrome.runtime.sendMessage({ type: 'AI_CHAT_STREAM_DONE' })
        },
        (error) => {
          currentStreamAbort = null
          chrome.runtime.sendMessage({
            type: 'AI_CHAT_STREAM_ERROR',
            data: error,
          })
        },
        currentStreamAbort.signal,
      )
    } catch (e: any) {
      currentStreamAbort = null
      chrome.runtime.sendMessage({
        type: 'AI_CHAT_STREAM_ERROR',
        data: e.message,
      })
    }
  },

  ABORT_STREAM: (_msg, _sender, sendResponse) => {
    if (currentStreamAbort) {
      currentStreamAbort.abort()
      currentStreamAbort = null
    }
    sendResponse({ success: true })
  },

  WAIT_FOR_STABLE: async (msg, _sender, sendResponse) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        sendResponse({ success: false, error: 'No active tab' })
        return
      }
      const timeout = msg.data?.timeout ?? 1500
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (timeoutMs: number) => {
          return new Promise<boolean>((resolve) => {
            let timer: ReturnType<typeof setTimeout>
            let settled = false
            const observer = new MutationObserver(() => {
              clearTimeout(timer)
              timer = setTimeout(() => {
                if (!settled) { settled = true; observer.disconnect(); resolve(true) }
              }, 300)
            })
            observer.observe(document.body, { childList: true, subtree: true, attributes: true })
            // Initial settle timer — if no mutations happen, resolve after 300ms
            timer = setTimeout(() => {
              if (!settled) { settled = true; observer.disconnect(); resolve(true) }
            }, 300)
            // Hard timeout
            setTimeout(() => {
              if (!settled) { settled = true; observer.disconnect(); resolve(true) }
            }, timeoutMs)
          })
        },
        args: [timeout],
        world: 'MAIN',
      })
      sendResponse({ success: true, data: results[0]?.result })
    } catch (e: any) {
      sendResponse({ success: false, error: e.message })
    }
  },

  AI_CHAT_AGENT: async (msg, _sender, sendResponse) => {
    try {
      const settings = await getSettings()
      if (!settings.apiKey) {
        sendResponse({ success: false, error: '请先配置 API Key' })
        return
      }
      const { task, html, screenshot, history } = msg.data
      const messages = buildAgentMessages(settings, task, html, screenshot, history)
      const reply = await callAI(settings, messages)
      sendResponse({ success: true, data: reply })
    } catch (e: any) {
      sendResponse({ success: false, error: e.message })
    }
  },
}
