import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai'
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama'
import type { Embeddings } from '@langchain/core/embeddings'

// LLM goes through Abacus's RouteLLM gateway (OpenAI-compatible chat format).
// Embeddings, by default, go to a LOCAL Ollama instance — free, offline, no
// API costs. Default model: `nomic-embed-text` (768-dim, fast, multilingual).
//
// Override knobs (all optional):
//   ABACUSAI_BASE_URL          default https://routellm.abacus.ai/v1
//   ABACUSAI_LLM_MODEL         default gpt-4o-mini
//   OLLAMA_BASE_URL            default http://localhost:11434
//   OLLAMA_EMBEDDINGS_MODEL    default nomic-embed-text
//   EMBEDDINGS_PROVIDER        ollama (default) | openai | abacus
//   OPENAI_API_KEY             required if EMBEDDINGS_PROVIDER=openai
//   OPENAI_EMBEDDINGS_MODEL    default text-embedding-3-small (when openai)

const DEFAULT_ABACUS_BASE_URL = 'https://routellm.abacus.ai/v1'
const DEFAULT_LLM_MODEL = 'gpt-4o-mini'
const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434'
const DEFAULT_OLLAMA_EMBEDDINGS_MODEL = 'nomic-embed-text'
const DEFAULT_OPENAI_EMBEDDINGS_MODEL = 'text-embedding-3-small'

let embeddings: Embeddings | null = null
let llm: ChatOpenAI | null = null

export class EmbeddingsUnavailableError extends Error {
  constructor(detail?: string) {
    super(
      detail ??
        'Embeddings unavailable. Install Ollama and pull `nomic-embed-text` (default) — see README — or set EMBEDDINGS_PROVIDER=openai with OPENAI_API_KEY.',
    )
    this.name = 'EmbeddingsUnavailableError'
  }
}

export class LLMUnavailableError extends Error {
  constructor(detail?: string) {
    super(
      detail ??
        'LLM unavailable: set ABACUSAI_API_KEY (default) or OPENAI_API_KEY.',
    )
    this.name = 'LLMUnavailableError'
  }
}

function abacusKey(): string | undefined {
  return process.env.ABACUSAI_API_KEY
}

function abacusBaseURL(): string {
  return process.env.ABACUSAI_BASE_URL || DEFAULT_ABACUS_BASE_URL
}

function embeddingsProvider(): 'ollama' | 'openai' | 'abacus' {
  const v = (process.env.EMBEDDINGS_PROVIDER || '').toLowerCase()
  if (v === 'openai' || v === 'abacus') return v
  return 'ollama'
}

// We can't synchronously prove that Ollama is reachable, but we can confirm
// that the configured provider has its prerequisites set. Endpoint failures
// surface at first call and propagate to the API response.
export function embeddingsAvailable(): boolean {
  switch (embeddingsProvider()) {
    case 'openai':
      return Boolean(process.env.OPENAI_API_KEY)
    case 'abacus':
      return Boolean(abacusKey())
    case 'ollama':
    default:
      return true
  }
}

export function llmAvailable(): boolean {
  return Boolean(abacusKey()) || Boolean(process.env.OPENAI_API_KEY)
}

export function getEmbeddings(): Embeddings {
  if (embeddings) return embeddings

  const provider = embeddingsProvider()

  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) {
      throw new EmbeddingsUnavailableError(
        'EMBEDDINGS_PROVIDER=openai but OPENAI_API_KEY is missing.',
      )
    }
    embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: process.env.OPENAI_EMBEDDINGS_MODEL || DEFAULT_OPENAI_EMBEDDINGS_MODEL,
    })
    return embeddings
  }

  if (provider === 'abacus') {
    const key = abacusKey()
    if (!key) {
      throw new EmbeddingsUnavailableError(
        'EMBEDDINGS_PROVIDER=abacus but ABACUSAI_API_KEY is missing.',
      )
    }
    embeddings = new OpenAIEmbeddings({
      openAIApiKey: key,
      modelName: process.env.ABACUSAI_EMBEDDINGS_MODEL || DEFAULT_OPENAI_EMBEDDINGS_MODEL,
      configuration: { baseURL: abacusBaseURL() },
    })
    return embeddings
  }

  // Default: Ollama (free, local).
  embeddings = new OllamaEmbeddings({
    model: process.env.OLLAMA_EMBEDDINGS_MODEL || DEFAULT_OLLAMA_EMBEDDINGS_MODEL,
    baseUrl: process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL,
  })
  return embeddings
}

export function getLLM(): ChatOpenAI {
  if (llm) return llm

  const key = abacusKey() || process.env.OPENAI_API_KEY
  if (!key) {
    throw new LLMUnavailableError()
  }
  llm = new ChatOpenAI({
    openAIApiKey: key,
    modelName: process.env.ABACUSAI_LLM_MODEL || DEFAULT_LLM_MODEL,
    configuration: abacusKey() ? { baseURL: abacusBaseURL() } : undefined,
  })
  return llm
}
