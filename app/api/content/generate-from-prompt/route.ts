import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { postProcessPage, type PagePostProcessBrief } from '@/lib/prompts/page-postprocess'
import { streamAnthropic } from '@/lib/llm/anthropic-stream'

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

  if (!process.env.ABACUSAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'No AI API key configured — set ABACUSAI_API_KEY or ANTHROPIC_API_KEY' }, { status: 500 })
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

  // Total chars of input — useful to log so we can see if Abacus is
  // refusing oversized requests vs returning empty for another reason.
  const inputBytes = systemPrompt.length + userPrompt.length
  console.log(`[generate-from-prompt] inbound: system=${systemPrompt.length} user=${userPrompt.length} total=${inputBytes} brief=${Boolean(brief)}`)

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

      // Provider routing — prefer Anthropic direct when:
      //   1. ANTHROPIC_API_KEY is set, AND
      //   2. operator opted in via LLM_PROVIDER=anthropic OR set CLAUDE_MODEL,
      //      OR no Abacus key exists (Anthropic is the only option).
      // Otherwise fall through to Abacus.AI's OpenAI-compatible gateway.
      const ENV_PROVIDER = (process.env.LLM_PROVIDER ?? '').toLowerCase()
      const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6'
      const ABACUS_MODEL = process.env.ABACUSAI_MODEL ?? 'gpt-5.4-mini'
      const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY)
      const hasAbacus = Boolean(process.env.ABACUSAI_API_KEY)
      const wantsAnthropic = ENV_PROVIDER === 'anthropic' || Boolean(process.env.CLAUDE_MODEL)
      const useAnthropic = hasAnthropic && (wantsAnthropic || !hasAbacus)

      const MODEL = useAnthropic ? CLAUDE_MODEL : ABACUS_MODEL
      const MAX_TOKENS_PAGE = Number(process.env.LLM_MAX_TOKENS_PAGE) || Number(process.env.ABACUSAI_MAX_TOKENS_PAGE) || (useAnthropic ? 8000 : 4096)
      const MAX_TOKENS_DEFAULT = Number(process.env.LLM_MAX_TOKENS) || Number(process.env.ABACUSAI_MAX_TOKENS) || 3500
      const MAX_TOKENS = brief ? MAX_TOKENS_PAGE : MAX_TOKENS_DEFAULT
      console.log(`[generate-from-prompt] provider=${useAnthropic ? 'anthropic' : 'abacus'} model=${MODEL} max_tokens=${MAX_TOKENS}`)

      async function callUpstream(maxTokens: number) {
        return fetch('https://apps.abacus.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.ABACUSAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              { role: 'user', content: userPrompt },
            ],
            stream: true,
            max_tokens: maxTokens,
          }),
          signal: upstreamAbort.signal,
        })
      }

      // Shared finalisation step — runs post-processing (when brief present),
      // emits the `completed` event, then the SSE terminator. Both provider
      // branches converge here so the post-processor + telemetry logic only
      // lives in one place.
      async function finishWith(fullText: string) {
        console.log(`[generate-from-prompt] stream complete. raw length: ${fullText.length} chars, brief present: ${Boolean(brief)}`)
        if (!fullText.trim()) {
          send({ status: 'error', message: 'LLM returned empty content (rate limit or upstream filter)' })
        } else {
          let finalText = fullText
          let postFixes: string[] = []
          if (brief) {
            try {
              const post = postProcessPage(fullText, brief)
              finalText = post.text.trim() ? post.text : fullText
              postFixes = post.fixes
              console.log(`[generate-from-prompt] post-processed length: ${finalText.length} chars, fixes: ${postFixes.length}`)
              if (postFixes.length) console.log('[generate-from-prompt] postprocess fixes:', postFixes)
            } catch (e) {
              console.error('[generate-from-prompt] postprocess threw, falling back to raw output:', e)
              finalText = fullText
            }
          }
          send({ status: 'completed', result: finalText, postFixes })
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
      }

      try {
        heartbeat = setInterval(() => {
          try { controller.enqueue(encoder.encode(`: ping\n\n`)) } catch {}
        }, 10000)

        // ──────────────────────────────────────────────────────────────────
        // Anthropic provider path — calls api.anthropic.com directly.
        // ──────────────────────────────────────────────────────────────────
        if (useAnthropic) {
          const r1 = await streamAnthropic({
            systemPrompt,
            userPrompt,
            model: MODEL,
            maxTokens: MAX_TOKENS,
            apiKey: process.env.ANTHROPIC_API_KEY!,
            signal: upstreamAbort.signal,
            onDelta: (delta) => send({ status: 'processing', delta }),
          })
          console.log(`[generate-from-prompt] anthropic attempt 1 — status=${r1.upstreamStatus} chunks=${r1.chunks} chars=${r1.text.length} terminated=${r1.terminated}`)
          if (r1.chunks === 0) console.log(`[generate-from-prompt] anthropic RAW SAMPLE:\n---\n${r1.rawSample}\n---`)

          let fullText = r1.text
          let streamChunks = r1.chunks

          // One retry on zero-content outcome (consistent with the Abacus path).
          if (streamChunks === 0) {
            console.warn('[generate-from-prompt] anthropic zero chunks — retrying once')
            send({ status: 'processing', delta: '' })
            const r2 = await streamAnthropic({
              systemPrompt,
              userPrompt,
              model: MODEL,
              maxTokens: MAX_TOKENS,
              apiKey: process.env.ANTHROPIC_API_KEY!,
              signal: upstreamAbort.signal,
              onDelta: (delta) => send({ status: 'processing', delta }),
            })
            console.log(`[generate-from-prompt] anthropic attempt 2 — status=${r2.upstreamStatus} chunks=${r2.chunks} chars=${r2.text.length} terminated=${r2.terminated}`)
            if (r2.chunks === 0) console.log(`[generate-from-prompt] anthropic attempt 2 RAW SAMPLE:\n---\n${r2.rawSample}\n---`)
            fullText = r2.text
            streamChunks = r2.chunks
          }

          await finishWith(fullText)
          return
        }

        // ──────────────────────────────────────────────────────────────────
        // Abacus.AI provider path — OpenAI-compatible gateway, original logic.
        // ──────────────────────────────────────────────────────────────────
        let upstream = await callUpstream(MAX_TOKENS)
        console.log(`[generate-from-prompt] upstream attempt 1 — status=${upstream.status} content-type=${upstream.headers.get('content-type')}`)

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => '')
          console.error(`[generate-from-prompt] upstream rejected: status=${upstream.status} body=${text.slice(0, 500)}`)
          send({ status: 'error', message: `LLM upstream error: ${upstream.status} ${text.slice(0, 200)}` })
          controller.close()
          return
        }

        async function readStream(body: ReadableStream<Uint8Array>): Promise<{ text: string; chunks: number; terminated: boolean; rawSample: string }> {
          const reader = body.getReader()
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
                    chunks++
                    send({ status: 'processing', delta })
                  }
                } catch {}
              }
            }
            return { text: fullText, chunks, terminated: false, rawSample }
          } catch (err: any) {
            console.error(`[generate-from-prompt] stream broke after ${chunks} chunks / ${fullText.length} chars:`, err?.message ?? err)
            return { text: fullText, chunks, terminated: true, rawSample }
          }
        }

        let { text: fullText, chunks: streamChunks, terminated, rawSample } = await readStream(upstream.body)
        console.log(`[generate-from-prompt] attempt 1 result: chunks=${streamChunks} chars=${fullText.length} terminated=${terminated}`)
        if (streamChunks === 0) {
          // Dump first 2000 bytes of the actual stream so we can see what the
          // model sent — reasoning tokens? error event? safety filter? empty?
          console.log(`[generate-from-prompt] attempt 1 RAW SAMPLE (first 2000 chars):\n---\n${rawSample}\n---`)
        }

        // Retry once on any 0-content outcome (termination OR clean stream
        // with no content tokens). Both signatures are consistent with a
        // transient Abacus issue; a retry usually succeeds.
        if (streamChunks === 0) {
          console.warn(`[generate-from-prompt] zero chunks (terminated=${terminated}) — retrying once`)
          send({ status: 'processing', delta: '' }) // keepalive
          upstream = await callUpstream(MAX_TOKENS)
          console.log(`[generate-from-prompt] upstream attempt 2 — status=${upstream.status}`)
          if (upstream.ok && upstream.body) {
            const r2 = await readStream(upstream.body)
            fullText = r2.text
            streamChunks = r2.chunks
            terminated = r2.terminated
            console.log(`[generate-from-prompt] attempt 2 result: chunks=${streamChunks} chars=${fullText.length} terminated=${terminated}`)
            if (streamChunks === 0) {
              console.log(`[generate-from-prompt] attempt 2 RAW SAMPLE (first 2000 chars):\n---\n${r2.rawSample}\n---`)
            }
          } else {
            const text = await upstream.text().catch(() => '')
            console.error(`[generate-from-prompt] retry rejected: status=${upstream.status} body=${text.slice(0, 500)}`)
          }
        }
        await finishWith(fullText)
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
