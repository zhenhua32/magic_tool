import { extractHTML } from './dom-extractor'
import type { ExtMessage } from '@/shared/types'

chrome.runtime.onMessage.addListener(
  (message: ExtMessage, _sender, sendResponse) => {
    if (message.type === 'GET_HTML') {
      try {
        const html = extractHTML()
        sendResponse({ success: true, data: html })
      } catch (e: any) {
        sendResponse({ success: false, error: e.message })
      }
      return true
    }
  },
)
