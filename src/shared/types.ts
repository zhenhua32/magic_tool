// ===== Settings =====
export interface Settings {
  apiBaseUrl: string
  apiKey: string
  modelType: 'text' | 'vision'
  modelName: string
  systemPrompt: string
  requestTimeout: number
  maxAgentSteps: number
  waitAfterExecution: number
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

元素定位策略（按优先级）：
1. 优先使用 id 选择器：document.querySelector('#exact-id')
2. 其次使用 data-testid / data-id：document.querySelector('[data-testid="xxx"]')
3. 再次使用唯一 class 组合：document.querySelector('.unique-class')
4. 使用文本内容匹配（适合按钮、链接）：[...document.querySelectorAll('button')].find(el => el.textContent.trim() === '确认')
5. 最后才用 nth-child 等位置选择器（最脆弱，应尽量避免）
6. 注意 HTML 中标注了 data-visible="false" 的元素是不可见的，不要操作它们
7. HTML 中标注了 disabled 的元素不可点击，需要在代码中说明

动态页面与 SPA 处理：
1. 操作前先确认目标元素存在，如果不存在则等待元素出现：
   function waitFor(selector, timeout = 5000) {
     return new Promise((resolve, reject) => {
       const el = document.querySelector(selector);
       if (el) return resolve(el);
       const observer = new MutationObserver(() => {
         const el = document.querySelector(selector);
         if (el) { observer.disconnect(); resolve(el); }
       });
       observer.observe(document.body, { childList: true, subtree: true });
       setTimeout(() => { observer.disconnect(); reject(new Error('等待超时: ' + selector)); }, timeout);
     });
   }
2. 对于 SPA 页面，点击导航后需要等待页面内容更新再进行下一步操作
3. 模态框/弹窗可能需要等待动画完成后再操作（通常 300-500ms）

错误修正：
1. 如果之前生成的代码执行失败，会收到错误信息，请根据错误信息修正代码
2. 常见错误：元素未找到（检查选择器）、元素不可交互（检查可见性/disabled）、跨域限制（改用其他方式）
3. 修正时只输出完整的修正后代码，不要输出 diff

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
  requestTimeout: 300,
  maxAgentSteps: 10,
  waitAfterExecution: 1500,
}

// ===== Chat =====
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  code?: string
  screenshot?: string
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
  | 'WAIT_FOR_STABLE'

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

// ===== Agent Mode =====
export type AgentState = 'idle' | 'running' | 'paused' | 'completed' | 'failed'

export interface AgentAction {
  thought: string
  code: string
  done: boolean
  summary?: string
}

export interface AgentStep {
  index: number
  action: AgentAction
  executionResult?: ExecuteResult
  htmlSnapshot?: string
  screenshot?: string
  timestamp: number
}
