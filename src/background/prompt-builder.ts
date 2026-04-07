import type { Settings, ChatMessage } from '@/shared/types'
import { DEFAULT_SYSTEM_PROMPT } from '@/shared/types'

const MAX_HISTORY_MESSAGES = 20

export function buildMessages(
  settings: Settings,
  userMessage: string,
  html: string,
  screenshot?: string,
  history?: ChatMessage[],
): { role: string; content: any }[] {
  const systemPrompt = settings.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT
  const messages: { role: string; content: any }[] = [
    { role: 'system', content: systemPrompt },
  ]

  // Append conversation history (excluding the current user message which is the last one)
  if (history && history.length > 0) {
    // Keep only recent messages to stay within token budget
    const trimmed = history.length > MAX_HISTORY_MESSAGES
      ? history.slice(-MAX_HISTORY_MESSAGES)
      : history
    for (const msg of trimmed) {
      // Skip the last user message — it will be added below with HTML context
      if (msg === history[history.length - 1] && msg.role === 'user') continue
      messages.push({
        role: msg.role === 'system' ? 'user' : msg.role,
        content: msg.content,
      })
    }
  }

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

// ===== Agent Mode Prompt =====

const AGENT_SYSTEM_PROMPT = `你是一个自主浏览器自动化 Agent。你将通过多轮循环来完成用户的任务。

每一轮你会收到：
1. 当前网页的 HTML 内容（可能还有截图）
2. 用户的任务描述（首次）或上一步的执行反馈

你必须输出严格的 JSON（不要使用 markdown 代码块包裹），格式如下：
{
  "thought": "分析当前页面状态，说明你的推理过程和下一步计划",
  "code": "要在页面上执行的 JavaScript 代码",
  "done": false
}

当任务完全完成时，输出：
{
  "thought": "任务已完成的分析",
  "code": "",
  "done": true,
  "summary": "对完成结果的简要总结"
}

规则：
1. 每次只执行一个原子操作（如：点击一个按钮、填写一个字段、滚动一次）
2. 代码必须使用原生 DOM API，自包含，不依赖外部库
3. 对可能找不到的元素做空值检查
4. 如果操作需要等待元素出现，使用 MutationObserver + Promise
5. 返回一个描述执行结果的字符串
6. 下载文件时，必须用 fetch + Blob + URL.createObjectURL，不要直接用 <a download> 下载跨域资源
7. 注意 HTML 中标注了 data-visible="false" 的元素是不可见的，不要操作它们
8. HTML 中标注了 disabled 的元素不可点击
9. 如果上一步执行失败，分析错误原因并调整策略
10. 不要重复执行已经成功的操作，观察页面变化来判断进度
11. 如果检测到页面没有变化，尝试其他方法来完成任务

元素定位策略（按优先级）：
1. id 选择器：document.querySelector('#exact-id')
2. data-testid / data-id：document.querySelector('[data-testid="xxx"]')
3. 唯一 class 组合：document.querySelector('.unique-class')
4. 文本内容匹配：[...document.querySelectorAll('button')].find(el => el.textContent.trim() === '确认')
5. nth-child 等位置选择器（最脆弱，应尽量避免）`

export function buildAgentMessages(
  settings: Settings,
  task: string,
  html: string,
  screenshot?: string,
  history?: { role: string; content: any }[],
): { role: string; content: any }[] {
  const messages: { role: string; content: any }[] = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
  ]

  if (history && history.length > 0) {
    const trimmed = history.length > MAX_HISTORY_MESSAGES
      ? history.slice(-MAX_HISTORY_MESSAGES)
      : history
    messages.push(...trimmed)
  }

  if (settings.modelType === 'vision' && screenshot) {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: `当前网页 HTML（已精简）:\n\n${html}\n\n任务: ${task}`,
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
      content: `当前网页 HTML（已精简）:\n\n${html}\n\n任务: ${task}`,
    })
  }

  return messages
}

export function buildAgentFeedbackMessage(
  success: boolean,
  resultOrError: string,
  html: string,
  settings: Settings,
  screenshot?: string,
): { role: string; content: any } {
  const feedback = success
    ? `上一步执行成功，返回结果: ${resultOrError}\n\n当前页面已更新，HTML 如下:\n\n${html}\n\n请分析页面状态并决定下一步操作。`
    : `上一步执行失败，错误信息: ${resultOrError}\n\n当前页面 HTML 如下:\n\n${html}\n\n请分析错误原因并调整策略。`

  if (settings.modelType === 'vision' && screenshot) {
    return {
      role: 'user',
      content: [
        { type: 'text', text: feedback },
        {
          type: 'image_url',
          image_url: {
            url: screenshot.startsWith('data:')
              ? screenshot
              : `data:image/png;base64,${screenshot}`,
          },
        },
      ],
    }
  }

  return { role: 'user', content: feedback }
}
