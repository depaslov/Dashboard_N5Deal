import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// TT §4.2 step 6: stream LLM completion for a pre-assembled prompt. Marketer
// has already reviewed/edited the system+user prompts in the textarea.
// No prompt building happens here — what comes in is what gets sent to the
// upstream model.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ABACUSAI_API_KEY) {
    return NextResponse.json({ error: 'AI API key is not configured on the server' }, { status: 500 })
  }

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const systemPrompt = String(body?.systemPrompt ?? '').trim()
  const userPrompt = String(body?.userPrompt ?? '').trim()
  if (!userPrompt) return NextResponse.json({ error: 'userPrompt is required' }, { status: 400 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: any) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      let heartbeat: any = null
      try {
        const upstream = await fetch('https://apps.abacus.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.ABACUSAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-5.4-mini',
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              { role: 'user', content: userPrompt },
            ],
            stream: true,
            max_tokens: 3500,
          }),
        })

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => '')
          send({ status: 'error', message: `LLM upstream error: ${upstream.status} ${text.slice(0, 200)}` })
          controller.close()
          return
        }

        heartbeat = setInterval(() => {
          try { controller.enqueue(encoder.encode(`: ping\n\n`)) } catch {}
        }, 10000)

        const reader = upstream.body.getReader()
        const decoder = new TextDecoder()
        let partial = ''
        let fullText = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          partial += decoder.decode(value, { stream: true })
          const lines = partial.split('\n')
          partial = lines.pop() ?? ''
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const data = trimmed.slice(5).trim()
            if (data === '[DONE]') { send({ status: 'completed', result: fullText }); continue }
            try {
              const parsed = JSON.parse(data)
              const delta: string = parsed?.choices?.[0]?.delta?.content ?? ''
              if (delta) {
                fullText += delta
                send({ status: 'processing', delta })
              }
            } catch {}
          }
        }
        send({ status: 'completed', result: fullText })
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
      } catch (err: any) {
        try { send({ status: 'error', message: err?.message ?? 'Generation failed' }) } catch {}
      } finally {
        if (heartbeat) clearInterval(heartbeat)
        try { controller.close() } catch {}
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
