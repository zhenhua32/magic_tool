// ===== Settings =====
export interface Settings {
  apiBaseUrl: string
  apiKey: string
  modelType: 'text' | 'vision'
  modelName: string
  systemPrompt: string
}

export const DEFAULT_SYSTEM_PROMPT = `你是一个浏览器自动化助手。用户会给你当前网页的 HTML 内容（可能还有截图）以及他们想要执行的操作。

你的任务是生成可以直接在浏览器控制台执行的 JavaScript 代码来完成用户的操作。

规则：
1. 只输出 JavaScript 代码，用 \`\`\`javascript 和 \`\`\` 包裹
2. 使用原生 DOM API（document.querySelector, click(), value 赋值等）
3. 代码必须是自包含的，不依赖外部库
4. 如果操作需要等待，使用 setTimeout 或 Promise
5. 对可能找不到的元素做空值检查
6. 如果操作涉及多个步骤，按顺序执行并加入适当延迟
7. 返回一个描述执行结果的字符串
8. 下载文件时，必须用 fetch 获取资源再通过 Blob + URL.createObjectURL 创建下载链接，不要直接用 <a download> 下载跨域资源（浏览器会忽略跨域的 download 属性）
9. 需要判断图片真实尺寸时，必须创建 new Image() 加载图片后读取 naturalWidth/naturalHeight，不要依赖页面中 img 元素的尺寸（可能是缩略图）或 URL 中的参数（如 w_1024 是 CDN 缩放参数，不代表原图尺寸）
10. 涉及大量异步操作（如批量下载）时，使用 async/await + 顺序执行或有限并发，避免同时发起过多请求

示例输出格式：
\`\`\`javascript
(function() {
  const btn = document.querySelector('#submit-btn');
  if (!btn) return '未找到提交按钮';
  btn.click();
  return '已点击提交按钮';
})();
\`\`\``

export const DEFAULT_SETTINGS: Settings = {
  apiBaseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  modelType: 'text',
  modelName: 'gpt-4o',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
}

// ===== Chat =====
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  code?: string
  timestamp: number
}

// ===== Scripts =====
export interface SavedScript {
  id: string
  name: string
  code: string
  urlPattern: string
  description: string
  createdAt: number
  updatedAt: number
}

// ===== Messages between extension parts =====
export type MessageType =
  | 'GET_HTML'
  | 'GET_HTML_RESULT'
  | 'EXECUTE_CODE'
  | 'EXECUTE_CODE_RESULT'
  | 'CAPTURE_SCREENSHOT'
  | 'AI_CHAT'
  | 'AI_CHAT_RESULT'
  | 'AI_CHAT_STREAM'
  | 'AI_CHAT_STREAM_CHUNK'
  | 'AI_CHAT_STREAM_DONE'
  | 'AI_CHAT_STREAM_ERROR'

export interface ExtMessage<T = any> {
  type: MessageType
  data?: T
}

export interface ExecuteResult {
  success: boolean
  result?: any
  error?: string
}

export interface AIChatRequest {
  messages: { role: string; content: any }[]
  stream?: boolean
}
