import type { Settings } from '@/shared/types'

const SYSTEM_PROMPT = `你是一个浏览器自动化助手。用户会给你当前网页的 HTML 内容（可能还有截图）以及他们想要执行的操作。

你的任务是生成可以直接在浏览器控制台执行的 JavaScript 代码来完成用户的操作。

规则：
1. 只输出 JavaScript 代码，用 \`\`\`javascript 和 \`\`\` 包裹
2. 使用原生 DOM API（document.querySelector, click(), value 赋值等）
3. 代码必须是自包含的，不依赖外部库
4. 如果操作需要等待，使用 setTimeout 或 Promise
5. 对可能找不到的元素做空值检查
6. 如果操作涉及多个步骤，按顺序执行并加入适当延迟
7. 返回一个描述执行结果的字符串

示例输出格式：
\`\`\`javascript
(function() {
  const btn = document.querySelector('#submit-btn');
  if (!btn) return '未找到提交按钮';
  btn.click();
  return '已点击提交按钮';
})();
\`\`\``

export function buildMessages(
  settings: Settings,
  userMessage: string,
  html: string,
  screenshot?: string,
): { role: string; content: any }[] {
  const messages: { role: string; content: any }[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ]

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
