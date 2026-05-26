// Streaming wrapper for direct Anthropic API calls.
//
// Returns the same { text, chunks, terminated, rawSample } shape as our
// Abacus streaming code so the generate/revise routes can swap providers
// without changing the surrounding logic.
//
// Why direct (no SDK):
//   - One streaming helper, ~120 lines, no extra dep to keep updated.
//   - Lets us preserve the per-chunk `onDelta` callback that the SSE
//     handler in the route relies on for real-time output.
//
// Anthropic SSE format (we parse content_block_delta with text_delta type):
//   event: content_block_delta
//   data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"..."}}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

export interface AnthropicStreamArgs {
  systemPrompt: string
  userPrompt: string
  model: string
  maxTokens: number
  apiKey: string
  signal?: AbortSignal
  onDelta: (delta: string) => void
}

export interface StreamResult {
  text: string
  chunks: number
  terminated: boolean
  rawSample: string
  upstreamStatus: number
}

export async function streamAnthropic(args: AnthropicStreamArgs): Promise<StreamResult> {
  const { systemPrompt, userPrompt, model, maxTokens, apiKey, signal, onDelta } = args

  const upstream = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      stream: true,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: 'user', content: userPrompt }],
    }),
    signal,
  })

  if (!upstream.ok || !upstream.body) {
    const body = await upstream.text().catch(() => '')
    return {
      text: '',
      chunks: 0,
      terminated: true,
      rawSample: body.slice(0, 2000),
      upstreamStatus: upstream.status,
    }
  }

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let partial = ''
  let fullText = ''
  let chunks = 0
  let rawSample = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const decoded = decoder.decode(value, { stream: true })
      if (rawSample.length < 2000) rawSample += decoded
      partial += decoded
      // Anthropic SSE separates events with blank lines. We parse line-by-line
      // because event/data pairs span multiple lines.
      const lines = partial.split('\n')
      partial = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (!data || data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          // We care about content_block_delta with text_delta — that's where
          // the actual response text streams in. Ignore everything else
          // (message_start, content_block_start, message_delta usage stats,
          // message_stop, ping events, etc).
          if (parsed?.type === 'content_block_delta' && parsed?.delta?.type === 'text_delta') {
            const piece: string = parsed.delta.text ?? ''
            if (piece) {
              fullText += piece
              chunks++
              onDelta(piece)
            }
          } else if (parsed?.type === 'error') {
            // Surface Anthropic-level errors in rawSample so the route logs them.
            rawSample += `\n[anthropic-error] ${JSON.stringify(parsed)}\n`
          }
        } catch {
          // Skip malformed JSON lines — Anthropic occasionally sends
          // partial frames; the buffer split handles re-stitching.
        }
      }
    }
    return { text: fullText, chunks, terminated: false, rawSample, upstreamStatus: upstream.status }
  } catch (err: any) {
    return { text: fullText, chunks, terminated: true, rawSample, upstreamStatus: upstream.status }
  }
}
