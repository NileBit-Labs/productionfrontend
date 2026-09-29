export interface AskVisual {
  type: 'bars' | 'ranking'
  title: string
  unit: 'ugx' | 'units' | 'count'
  points: { label: string; value: number }[]
}

export interface AskStatus {
  enabled: boolean
  is_owner: boolean
  asked_today: number
  daily_limit: number
  suggestions: string[]
}

export interface AskReply {
  answer: string
  status: 'ok' | 'incomplete' | 'blocked'
  visuals: AskVisual[]
  tools: string[]
}

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
  visuals?: AskVisual[]
  tools?: string[]
  // An answer that couldn't be produced: shown in the thread with a "Try again" button.
  error?: { message: string; code?: string; question: string }
}
