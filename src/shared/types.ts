// ===== Settings =====
export interface Settings {
  apiBaseUrl: string
  apiKey: string
  modelType: 'text' | 'vision'
  modelName: string
}

export const DEFAULT_SETTINGS: Settings = {
  apiBaseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  modelType: 'text',
  modelName: 'gpt-4o',
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
