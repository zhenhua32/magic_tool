import { ref, computed } from 'vue'
import type { AgentState, AgentStep, AgentAction, ChatMessage, Settings } from '@/shared/types'
import { generateId } from '@/shared/storage'
import { getContextBudgets } from '@/background/prompt-builder'

const MAX_CONSECUTIVE_FAILURES = 3

export function useAgent() {
  const agentState = ref<AgentState>('idle')
  const agentSteps = ref<AgentStep[]>([])
  const currentStepIndex = ref(0)
  const agentTask = ref('')
  const messages = ref<ChatMessage[]>([])
  const consecutiveFailures = ref(0)
  const targetTabId = ref<number | null>(null)

  const isAgentRunning = computed(() => agentState.value === 'running')

  // ---- Low-level messaging helpers ----

  function sendChromeMessage<T = any>(msg: { type: string; data?: any }): Promise<T> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (res) => resolve(res as T))
    })
  }

  async function resolveTargetTabId(): Promise<number> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) throw new Error('无法获取当前标签页')
    return tab.id
  }

  async function getPageHTML(maxHtmlLength?: number): Promise<string> {
    const res = await sendChromeMessage({ type: 'GET_HTML', data: { tabId: targetTabId.value, maxHtmlLength } })
    return res?.success ? res.data : '<p>无法获取页面内容</p>'
  }

  async function captureScreenshot(): Promise<string | undefined> {
    const res = await sendChromeMessage({ type: 'CAPTURE_SCREENSHOT', data: { tabId: targetTabId.value } })
    return res?.success ? res.data : undefined
  }

  async function executeCode(code: string): Promise<{ success: boolean; result?: string; error?: string }> {
    return sendChromeMessage({ type: 'EXECUTE_CODE', data: { code, tabId: targetTabId.value } })
  }

  async function waitForPageStable(timeout: number): Promise<void> {
    await sendChromeMessage({ type: 'WAIT_FOR_STABLE', data: { timeout, tabId: targetTabId.value } })
  }

  async function callAgentAI(
    task: string,
    html: string,
    screenshot: string | undefined,
    history: { role: string; content: any }[],
  ): Promise<string> {
    const res = await sendChromeMessage({
      type: 'AI_CHAT_AGENT',
      data: { task, html, screenshot, history },
    })
    if (res?.success) return res.data
    throw new Error(res?.error ?? '未知错误')
  }

  // ---- JSON parsing ----

  function parseAgentResponse(text: string): AgentAction {
    // Try direct JSON parse first
    try {
      const parsed = JSON.parse(text)
      if (typeof parsed.thought === 'string' && typeof parsed.done === 'boolean') {
        return {
          thought: parsed.thought,
          code: parsed.code ?? '',
          done: parsed.done,
          summary: parsed.summary,
        }
      }
    } catch { /* ignore */ }

    // Try to extract JSON from markdown code block
    const jsonBlockMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/)
    if (jsonBlockMatch) {
      try {
        const parsed = JSON.parse(jsonBlockMatch[1])
        if (typeof parsed.thought === 'string' && typeof parsed.done === 'boolean') {
          return {
            thought: parsed.thought,
            code: parsed.code ?? '',
            done: parsed.done,
            summary: parsed.summary,
          }
        }
      } catch { /* ignore */ }
    }

    // Fallback: extract JavaScript code block (backward compat)
    const codeMatch = text.match(/```(?:javascript|js)\s*\n([\s\S]*?)\n```/)
    if (codeMatch) {
      return {
        thought: text.replace(codeMatch[0], '').trim().slice(0, 200),
        code: codeMatch[1].trim(),
        done: false,
      }
    }

    throw new Error('无法解析 AI 回复为有效的 Agent 动作')
  }

  // ---- Context management (sliding window) ----

  function buildCompactHistory(
    steps: AgentStep[],
    settings: Settings,
  ): { role: string; content: any }[] {
    const history: { role: string; content: any }[] = []
    const SUMMARY_THRESHOLD = 5

    if (steps.length <= SUMMARY_THRESHOLD) {
      // Keep everything
      for (const step of steps) {
        // AI response
        history.push({
          role: 'assistant',
          content: JSON.stringify({
            thought: step.action.thought,
            code: step.action.code,
            done: step.action.done,
            ...(step.action.summary ? { summary: step.action.summary } : {}),
          }),
        })
        // Execution feedback
        if (step.executionResult) {
          const success = step.executionResult.success
          const resultText = success
            ? (step.executionResult.result ?? 'done')
            : (step.executionResult.error ?? '未知错误')
          history.push({
            role: 'user',
            content: success
              ? `执行成功: ${resultText}`
              : `执行失败: ${resultText}`,
          })
        }
      }
    } else {
      // Summarize early steps, keep recent ones in full
      const earlySteps = steps.slice(0, steps.length - SUMMARY_THRESHOLD)
      const recentSteps = steps.slice(-SUMMARY_THRESHOLD)

      const summaryParts = earlySteps.map((s, i) => {
        const status = s.executionResult?.success ? '✓' : '✗'
        return `步骤${i + 1} [${status}]: ${s.action.thought.slice(0, 60)}`
      })

      history.push({
        role: 'user',
        content: `之前步骤摘要:\n${summaryParts.join('\n')}`,
      })

      for (const step of recentSteps) {
        history.push({
          role: 'assistant',
          content: JSON.stringify({
            thought: step.action.thought,
            code: step.action.code,
            done: step.action.done,
          }),
        })
        if (step.executionResult) {
          const success = step.executionResult.success
          const resultText = success
            ? (step.executionResult.result ?? 'done')
            : (step.executionResult.error ?? '未知错误')
          history.push({
            role: 'user',
            content: success ? `执行成功: ${resultText}` : `执行失败: ${resultText}`,
          })
        }
      }
    }

    return history
  }

  // ---- Helper to add chat messages for UI ----

  function addMessage(role: ChatMessage['role'], content: string, code?: string, screenshot?: string): ChatMessage {
    const msg: ChatMessage = {
      id: generateId(),
      role,
      content,
      code,
      screenshot,
      timestamp: Date.now(),
    }
    messages.value = [...messages.value, msg]
    return msg
  }

  // ---- Core Agent Loop ----

  async function startAgent(task: string) {
    const settingsResult = await chrome.storage.local.get('settings')
    const settings: Settings = settingsResult.settings

    // Lock target tab at the moment agent starts
    targetTabId.value = await resolveTargetTabId()

    agentState.value = 'running'
    agentTask.value = task
    agentSteps.value = []
    currentStepIndex.value = 0
    consecutiveFailures.value = 0
    messages.value = []

    const maxSteps = settings?.maxAgentSteps ?? 10
    const waitTime = settings?.waitAfterExecution ?? 1500
    const { maxHtmlLength } = getContextBudgets(settings)

    addMessage('user', `🤖 Agent 任务: ${task}`)

    try {
      while (agentState.value === 'running' && currentStepIndex.value < maxSteps) {
        const stepIdx = currentStepIndex.value

        // 1. Collect page state
        addMessage('system', `⏳ 步骤 ${stepIdx + 1}: 正在采集页面状态...`)
        const html = await getPageHTML(maxHtmlLength)
        let screenshot: string | undefined
        if (settings?.modelType === 'vision') {
          screenshot = await captureScreenshot()
        }

        if (agentState.value !== 'running') break

        // 2. Build context and call AI
        addMessage('system', `🧠 步骤 ${stepIdx + 1}: 正在分析...`)
        const history = buildCompactHistory(agentSteps.value, settings)
        const taskText = stepIdx === 0
          ? task
          : `继续执行任务: ${task}`

        let aiReply: string
        try {
          aiReply = await callAgentAI(taskText, html, screenshot, history)
        } catch (e: any) {
          addMessage('system', `❌ AI 调用失败: ${e.message}`)
          agentState.value = 'failed'
          break
        }

        if (agentState.value !== 'running') break

        // 3. Parse response
        let action: AgentAction
        try {
          action = parseAgentResponse(aiReply)
        } catch (e: any) {
          addMessage('system', `❌ 解析 AI 回复失败: ${e.message}\n原始回复: ${aiReply.slice(0, 300)}`)
          consecutiveFailures.value++
          if (consecutiveFailures.value >= MAX_CONSECUTIVE_FAILURES) {
            addMessage('system', `⚠️ 连续失败 ${MAX_CONSECUTIVE_FAILURES} 次，Agent 已暂停`)
            agentState.value = 'paused'
            break
          }
          currentStepIndex.value++
          continue
        }

        // Create step record
        const step: AgentStep = {
          index: stepIdx,
          action,
          timestamp: Date.now(),
          htmlSnapshot: html.slice(0, 500),
          screenshot,
        }

        // Show thought
        addMessage('assistant', `**💭 思考:** ${action.thought}`, action.code || undefined)

        // 4. Check if done
        if (action.done) {
          step.executionResult = { success: true, result: action.summary ?? '任务完成' }
          agentSteps.value = [...agentSteps.value, step]
          addMessage('system', `✅ Agent 完成: ${action.summary ?? '任务已完成'}`)
          agentState.value = 'completed'
          break
        }

        // 5. Execute code
        if (!action.code.trim()) {
          addMessage('system', `⚠️ AI 未生成代码，跳过执行`)
          step.executionResult = { success: false, error: '空代码' }
          agentSteps.value = [...agentSteps.value, step]
          currentStepIndex.value++
          consecutiveFailures.value++
          if (consecutiveFailures.value >= MAX_CONSECUTIVE_FAILURES) {
            addMessage('system', `⚠️ 连续失败 ${MAX_CONSECUTIVE_FAILURES} 次，Agent 已暂停`)
            agentState.value = 'paused'
            break
          }
          continue
        }

        addMessage('system', `▶️ 步骤 ${stepIdx + 1}: 正在执行代码...`)
        const execResult = await executeCode(action.code)
        step.executionResult = execResult

        if (execResult.success) {
          addMessage('system', `✅ 步骤 ${stepIdx + 1} 执行成功: ${execResult.result ?? 'done'}`)
          consecutiveFailures.value = 0
        } else {
          addMessage('system', `❌ 步骤 ${stepIdx + 1} 执行失败: ${execResult.error}`)
          consecutiveFailures.value++
          if (consecutiveFailures.value >= MAX_CONSECUTIVE_FAILURES) {
            agentSteps.value = [...agentSteps.value, step]
            addMessage('system', `⚠️ 连续失败 ${MAX_CONSECUTIVE_FAILURES} 次，Agent 已暂停。你可以继续或停止。`)
            agentState.value = 'paused'
            break
          }
        }

        agentSteps.value = [...agentSteps.value, step]

        if (agentState.value !== 'running') break

        // 6. Wait for page to stabilize
        addMessage('system', `⏳ 等待页面稳定...`)
        await waitForPageStable(waitTime)

        // Duplicate code detection
        if (agentSteps.value.length >= 2) {
          const prev = agentSteps.value[agentSteps.value.length - 2]
          if (prev.action.code === action.code) {
            addMessage('system', `⚠️ 检测到重复操作，Agent 已暂停`)
            agentState.value = 'paused'
            break
          }
        }

        currentStepIndex.value++
      }

      // Max steps reached
      if (agentState.value === 'running' && currentStepIndex.value >= maxSteps) {
        addMessage('system', `⚠️ 已达到最大步骤数 (${maxSteps})，Agent 已暂停。你可以增加上限或手动继续。`)
        agentState.value = 'paused'
      }
    } catch (e: any) {
      addMessage('system', `❌ Agent 异常: ${e.message}`)
      agentState.value = 'failed'
    }
  }

  async function resumeAgent() {
    if (agentState.value !== 'paused') return
    const settingsResult = await chrome.storage.local.get('settings')
    const settings: Settings = settingsResult.settings
    const maxSteps = (settings?.maxAgentSteps ?? 10) + currentStepIndex.value
    const { maxHtmlLength } = getContextBudgets(settings)

    agentState.value = 'running'
    consecutiveFailures.value = 0
    addMessage('system', `▶️ Agent 继续执行...`)

    // Re-enter the loop from where we left off
    try {
      while (agentState.value === 'running' && currentStepIndex.value < maxSteps) {
        const stepIdx = currentStepIndex.value
        const html = await getPageHTML(maxHtmlLength)
        let screenshot: string | undefined
        if (settings?.modelType === 'vision') {
          screenshot = await captureScreenshot()
        }

        if (agentState.value !== 'running') break

        addMessage('system', `🧠 步骤 ${stepIdx + 1}: 正在分析...`)
        const history = buildCompactHistory(agentSteps.value, settings)

        let aiReply: string
        try {
          aiReply = await callAgentAI(`继续执行任务: ${agentTask.value}`, html, screenshot, history)
        } catch (e: any) {
          addMessage('system', `❌ AI 调用失败: ${e.message}`)
          agentState.value = 'failed'
          break
        }

        if (agentState.value !== 'running') break

        let action: AgentAction
        try {
          action = parseAgentResponse(aiReply)
        } catch (e: any) {
          addMessage('system', `❌ 解析失败: ${e.message}`)
          consecutiveFailures.value++
          if (consecutiveFailures.value >= MAX_CONSECUTIVE_FAILURES) {
            agentState.value = 'paused'
            addMessage('system', `⚠️ 连续失败 ${MAX_CONSECUTIVE_FAILURES} 次，Agent 已暂停`)
            break
          }
          currentStepIndex.value++
          continue
        }

        const step: AgentStep = {
          index: stepIdx,
          action,
          timestamp: Date.now(),
          htmlSnapshot: html.slice(0, 500),
          screenshot,
        }

        addMessage('assistant', `**💭 思考:** ${action.thought}`, action.code || undefined)

        if (action.done) {
          step.executionResult = { success: true, result: action.summary ?? '任务完成' }
          agentSteps.value = [...agentSteps.value, step]
          addMessage('system', `✅ Agent 完成: ${action.summary ?? '任务已完成'}`)
          agentState.value = 'completed'
          break
        }

        if (!action.code.trim()) {
          step.executionResult = { success: false, error: '空代码' }
          agentSteps.value = [...agentSteps.value, step]
          currentStepIndex.value++
          consecutiveFailures.value++
          if (consecutiveFailures.value >= MAX_CONSECUTIVE_FAILURES) {
            agentState.value = 'paused'
            break
          }
          continue
        }

        addMessage('system', `▶️ 步骤 ${stepIdx + 1}: 正在执行代码...`)
        const execResult = await executeCode(action.code)
        step.executionResult = execResult

        if (execResult.success) {
          addMessage('system', `✅ 步骤 ${stepIdx + 1} 执行成功: ${execResult.result ?? 'done'}`)
          consecutiveFailures.value = 0
        } else {
          addMessage('system', `❌ 步骤 ${stepIdx + 1} 执行失败: ${execResult.error}`)
          consecutiveFailures.value++
          if (consecutiveFailures.value >= MAX_CONSECUTIVE_FAILURES) {
            agentSteps.value = [...agentSteps.value, step]
            agentState.value = 'paused'
            addMessage('system', `⚠️ 连续失败 ${MAX_CONSECUTIVE_FAILURES} 次，Agent 已暂停`)
            break
          }
        }

        agentSteps.value = [...agentSteps.value, step]
        if (agentState.value !== 'running') break

        const waitTime = settings?.waitAfterExecution ?? 1500
        await waitForPageStable(waitTime)

        if (agentSteps.value.length >= 2) {
          const prev = agentSteps.value[agentSteps.value.length - 2]
          if (prev.action.code === action.code) {
            addMessage('system', `⚠️ 检测到重复操作，Agent 已暂停`)
            agentState.value = 'paused'
            break
          }
        }

        currentStepIndex.value++
      }
    } catch (e: any) {
      addMessage('system', `❌ Agent 异常: ${e.message}`)
      agentState.value = 'failed'
    }
  }

  function stopAgent() {
    if (agentState.value === 'running' || agentState.value === 'paused') {
      agentState.value = 'idle'
      addMessage('system', '⏹️ Agent 已停止')
    }
  }

  function resetAgent() {
    agentState.value = 'idle'
    agentSteps.value = []
    currentStepIndex.value = 0
    consecutiveFailures.value = 0
    agentTask.value = ''
    targetTabId.value = null
    messages.value = []
  }

  return {
    agentState,
    agentSteps,
    currentStepIndex,
    agentTask,
    messages,
    isAgentRunning,
    startAgent,
    resumeAgent,
    stopAgent,
    resetAgent,
  }
}
