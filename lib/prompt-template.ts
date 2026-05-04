// Tiny placeholder renderer for PromptTemplate. Supports:
//   {{key}}                     — flat substitution
//   {{key.subKey}}              — dot-notation
//   {{#if key}}...{{/if}}       — conditional block; rendered only if value is truthy non-empty
// Missing keys are replaced with empty string. The renderer is intentionally
// minimal so templates stay easy to write and audit.

export type RenderContext = Record<string, any>

function getPath(ctx: RenderContext, path: string): any {
  const parts = path.split('.')
  let cur: any = ctx
  for (const p of parts) {
    if (cur == null) return undefined
    cur = cur[p]
  }
  return cur
}

function isTruthy(v: any): boolean {
  if (v == null) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  return Boolean(v)
}

export function renderTemplate(template: string, ctx: RenderContext): string {
  if (!template) return ''
  // Conditional blocks first (greedy by key, allow nested-friendly syntax)
  let out = template.replace(
    /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_m, key, body) => (isTruthy(getPath(ctx, key)) ? body : ''),
  )
  // Flat substitution
  out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
    const v = getPath(ctx, key)
    if (v == null) return ''
    if (Array.isArray(v)) return v.join(', ')
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  })
  // Trim runs of blank lines that conditionals leave behind
  return out.replace(/\n{3,}/g, '\n\n').trim()
}
