import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { postProcessPage, type PagePostProcessBrief } from '@/lib/prompts/page-postprocess'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Vercel caps this at 60s on Hobby plans and 300s on Pro. Setting 300 means
// we use the full budget on Pro and the platform clamps to 60 on Hobby.
export const maxDuration = 300

// TT §4.2 step 6: stream LLM completion for a pre-assembled prompt. Marketer
// has already reviewed/edited the system+user prompts in the textarea.
// No prompt building happens here — what comes in is what gets sent to the
// upstream model.
//
// If the request includes a `brief` field (forwarded from assemble-prompt),
// we run the deterministic page post-processor on the LLM output before
// returning the `completed` event. The post-processor enforces:
//   - keyword MAX (rewrites H2/H3 headings until count ≤ MAX)
//   - internal-link whitelist (strips invented + duplicate URLs)
//   - metadata header (injects Word Count + Reading Time + Tags)
// Without the brief field we behave exactly as before — raw LLM output.
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

  // Optional brief snapshot — when provided, the LLM output is post-processed
  // server-side to enforce keyword cap + link whitelist + metadata header.
  const briefRaw = body?.brief
  const brief: PagePostProcessBrief | null = briefRaw && typeof briefRaw === 'object' ? {
    topic: typeof briefRaw.topic === 'string' ? briefRaw.topic : undefined,
    primaryKeyword: briefRaw.primaryKeyword && briefRaw.primaryKeyword.term
      ? {
          term: String(briefRaw.primaryKeyword.term),
          minCount: Math.max(1, Number(briefRaw.primaryKeyword.minCount ?? 1)),
          maxCount: Number.isFinite(Number(briefRaw.primaryKeyword.maxCount)) && Number(briefRaw.primaryKeyword.maxCount) > 0
            ? Math.floor(Number(briefRaw.primaryKeyword.maxCount))
            : undefined,
        }
      : undefined,
    secondaryKeywords: Array.isArray(briefRaw.secondaryKeywords)
      ? briefRaw.secondaryKeywords.map((k: any) => ({
          term: String(k?.term ?? ''),
          minCount: Math.max(1, Number(k?.minCount ?? 1)),
          maxCount: Number.isFinite(Number(k?.maxCount)) && Number(k?.maxCount) > 0 ? Math.floor(Number(k.maxCount)) : undefined,
        })).filter((k: any) => k.term)
      : [],
    lsiKeywords: Array.isArray(briefRaw.lsiKeywords) ? briefRaw.lsiKeywords.map((s: any) => String(s)).filter(Boolean) : [],
    internalLinks: Array.isArray(briefRaw.internalLinks)
      ? briefRaw.internalLinks.map((l: any) => ({
          url: String(l?.url ?? ''),
          anchor: String(l?.anchor ?? ''),
          priority: l?.priority === 'must' ? 'must' : 'nice',
        })).filter((l: any) => l.url && l.anchor)
      : [],
  } : null

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: any) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      let heartbeat: any = null
      const upstreamAbort = new AbortController()
      // Hard cap on the upstream call (slightly less than maxDuration to leave
      // room for the final flush). If the LLM hangs we abort and surface an
      // error instead of returning empty content.
      const upstreamTimeout = setTimeout(() => upstreamAbort.abort(), 280_000)
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
          signal: upstreamAbort.signal,
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
            if (data === '[DONE]') continue
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
        if (!fullText.trim()) {
          send({ status: 'error', message: 'LLM returned empty content (rate limit or upstream filter)' })
        } else {
          let finalText = fullText
          let postFixes: string[] = []
          if (brief) {
            const post = postProcessPage(fullText, brief)
            finalText = post.text
            postFixes = post.fixes
            if (postFixes.length) console.log('[generate-from-prompt] postprocess fixes:', postFixes)
          }
          send({ status: 'completed', result: finalText, postFixes })
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
      } catch (err: any) {
        const msg = err?.name === 'AbortError'
          ? 'Generation timed out after 280s — the model took too long to respond'
          : err?.message ?? 'Generation failed'
        try { send({ status: 'error', message: msg }) } catch {}
      } finally {
        clearTimeout(upstreamTimeout)
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
