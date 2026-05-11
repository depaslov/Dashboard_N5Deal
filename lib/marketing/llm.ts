// Vision-LLM helper for Marketing OS. Uses the same Abacus.AI RouteLLM
// endpoint as /api/content/generate-from-prompt (OpenAI-compatible chat
// completions), but with image inputs for screenshot analysis.
//
// Defaults to a vision-capable model. Override via ABACUSAI_VISION_MODEL.

const API_URL = 'https://apps.abacus.ai/v1/chat/completions'
const DEFAULT_MODEL = process.env.ABACUSAI_VISION_MODEL ?? 'gpt-4o'

export class MissingLLMKey extends Error {
  constructor() {
    super('ABACUSAI_API_KEY is not configured on the server')
    this.name = 'MissingLLMKey'
  }
}

export type LLMContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | LLMContentPart[]
}

// Convert an Anthropic-style image block to OpenAI's image_url format
export function imageBlock(dataUrl: string): LLMContentPart {
  return { type: 'image_url', image_url: { url: dataUrl } }
}

export function textBlock(text: string): LLMContentPart {
  return { type: 'text', text }
}

export async function callLLM(
  messages: LLMMessage[],
  options: { maxTokens?: number; model?: string } = {},
): Promise<string> {
  const key = process.env.ABACUSAI_API_KEY
  if (!key) throw new MissingLLMKey()

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODEL,
      messages,
      max_tokens: options.maxTokens ?? 4096,
      stream: false,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`LLM upstream error ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = await res.json()
  const text: string = data?.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error('LLM returned empty content')
  return text
}
