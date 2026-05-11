// Thin wrapper around the Anthropic Messages API used by the Reports module.
// Reads ANTHROPIC_API_KEY from env. If absent, throws a structured error so
// the API route can return a clean 503.

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-5'

export class MissingAnthropicKey extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY is not configured on the server')
    this.name = 'MissingAnthropicKey'
  }
}

export interface MessageContent {
  type: 'text' | 'image'
  text?: string
  source?: { type: 'base64'; media_type: string; data: string }
}

export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: MessageContent[]
}

export async function callAnthropic(
  messages: AnthropicMessage[],
  options: { maxTokens?: number; system?: string } = {},
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new MissingAnthropicKey()

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: options.maxTokens ?? 4096,
      ...(options.system ? { system: options.system } : {}),
      messages,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = await res.json()
  const text: string = data?.content?.[0]?.text ?? ''
  if (!text) throw new Error('Anthropic returned empty content')
  return text
}
