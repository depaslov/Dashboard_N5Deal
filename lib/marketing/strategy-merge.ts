// Pure helpers used by the Strategy Importer. The shape mirrors the JSON
// columns on MarketingStrategy so we can dedup additions against what's
// already saved and then merge approved items back without re-implementing
// the same logic on both sides of the LLM call.

export type BudgetData = Record<string, Record<string, {
  min: number; max: number; actual: number; purpose: string
}>>

export type GoalsData = Record<string, Record<string, {
  baseline: number; target: number; actual: number; unit?: string; label?: string
}>>

export type Directives = Record<string, { title: string; color: string; body: string }>

export interface CurrentStateData {
  asOf?: string
  channels?: Record<string, {
    label: string
    color?: string
    metrics?: { label: string; value: string }[]
    diagnosis?: string
  }>
  gap?: string
}

export interface AuthorityLayerData {
  coreShift?: string
  positioning?: string
  q3Events?: { id: string; name: string; month: string; role: string; goals: string[] }[]
  california?: { name: string; kind: string; positioning: string; goals: string[] }
  reportSystem?: {
    intro?: string
    parts?: { n: number; title: string; desc: string }[]
  }
  measurement?: string[]
}

export interface StrategySnapshot {
  budget: BudgetData
  goals: GoalsData
  channelDirectives: Directives
  currentState: CurrentStateData
  authorityLayer: AuthorityLayerData
}

// Additions schema returned by the analyzer. Same shape as StrategySnapshot
// but every leaf is OPTIONAL — analyzer only includes pieces that are
// genuinely missing from the current snapshot. UI walks this tree and
// shows each entry as a checkbox; user-curated subset gets sent to
// /apply for the actual merge.
export interface StrategyAdditions {
  budget?: BudgetData
  goals?: GoalsData
  channelDirectives?: Directives
  currentState?: {
    asOf?: string
    channels?: CurrentStateData['channels']
    gap?: string
  }
  authorityLayer?: {
    coreShift?: string
    positioning?: string
    q3Events?: NonNullable<AuthorityLayerData['q3Events']>
    california?: AuthorityLayerData['california']
    reportSystem?: AuthorityLayerData['reportSystem']
    measurement?: string[]
  }
}

// Empty-safe default snapshot — used as the baseline for dedup when a
// project has only some of the fields populated.
export function emptySnapshot(): StrategySnapshot {
  return {
    budget: {},
    goals: {},
    channelDirectives: {},
    currentState: {},
    authorityLayer: {},
  }
}

// Filter a candidate additions object against the current snapshot — drops
// anything whose key already exists. Run after the LLM has done its
// best-effort dedup so we have a deterministic guarantee that nothing
// gets overwritten even if the LLM slips up.
export function filterAdditions(
  candidates: StrategyAdditions,
  current: StrategySnapshot,
): StrategyAdditions {
  const out: StrategyAdditions = {}

  // Budget: keyed by (month, channel) — month outer, channel inner.
  if (candidates.budget) {
    for (const [month, channels] of Object.entries(candidates.budget)) {
      for (const [channel, item] of Object.entries(channels)) {
        const exists = current.budget?.[month]?.[channel]
        if (exists) continue
        out.budget ??= {}
        out.budget[month] ??= {}
        out.budget[month][channel] = item
      }
    }
  }

  // Goals: keyed by (channel, metric).
  if (candidates.goals) {
    for (const [channel, metrics] of Object.entries(candidates.goals)) {
      for (const [metric, item] of Object.entries(metrics)) {
        const exists = current.goals?.[channel]?.[metric]
        if (exists) continue
        out.goals ??= {}
        out.goals[channel] ??= {}
        out.goals[channel][metric] = item
      }
    }
  }

  // channelDirectives: keyed by channel.
  if (candidates.channelDirectives) {
    for (const [channel, directive] of Object.entries(candidates.channelDirectives)) {
      if (current.channelDirectives?.[channel]) continue
      out.channelDirectives ??= {}
      out.channelDirectives[channel] = directive
    }
  }

  // currentState: scalar fields (asOf, gap) only get proposed if currently
  // empty. channels keyed by channel name.
  if (candidates.currentState) {
    const cs: StrategyAdditions['currentState'] = {}
    if (candidates.currentState.asOf && !current.currentState?.asOf) {
      cs.asOf = candidates.currentState.asOf
    }
    if (candidates.currentState.gap && !current.currentState?.gap) {
      cs.gap = candidates.currentState.gap
    }
    if (candidates.currentState.channels) {
      for (const [channel, data] of Object.entries(candidates.currentState.channels)) {
        if (current.currentState?.channels?.[channel]) continue
        cs.channels ??= {}
        cs.channels[channel] = data
      }
    }
    if (cs.asOf || cs.gap || (cs.channels && Object.keys(cs.channels).length > 0)) {
      out.currentState = cs
    }
  }

  // authorityLayer: scalars + arrays. Scalars only if currently empty;
  // q3Events deduped by `name`; measurement deduped by exact string match.
  if (candidates.authorityLayer) {
    const al: StrategyAdditions['authorityLayer'] = {}
    if (candidates.authorityLayer.coreShift && !current.authorityLayer?.coreShift) {
      al.coreShift = candidates.authorityLayer.coreShift
    }
    if (candidates.authorityLayer.positioning && !current.authorityLayer?.positioning) {
      al.positioning = candidates.authorityLayer.positioning
    }
    if (candidates.authorityLayer.california && !current.authorityLayer?.california) {
      al.california = candidates.authorityLayer.california
    }
    if (candidates.authorityLayer.reportSystem && !current.authorityLayer?.reportSystem) {
      al.reportSystem = candidates.authorityLayer.reportSystem
    }
    if (candidates.authorityLayer.q3Events) {
      const existingNames = new Set((current.authorityLayer?.q3Events ?? []).map((e) => e.name.toLowerCase()))
      const fresh = candidates.authorityLayer.q3Events.filter((e) => !existingNames.has(e.name.toLowerCase()))
      if (fresh.length > 0) al.q3Events = fresh
    }
    if (candidates.authorityLayer.measurement) {
      const existing = new Set((current.authorityLayer?.measurement ?? []).map((s) => s.toLowerCase().trim()))
      const fresh = candidates.authorityLayer.measurement.filter((s) => !existing.has(s.toLowerCase().trim()))
      if (fresh.length > 0) al.measurement = fresh
    }
    if (Object.keys(al).length > 0) out.authorityLayer = al
  }

  return out
}

// Count how many leaf items the additions object holds — used in the UI
// header so the operator sees "12 new items proposed" before clicking
// through the tree.
export function countAdditions(additions: StrategyAdditions): number {
  let n = 0
  if (additions.budget) {
    for (const months of Object.values(additions.budget)) {
      n += Object.keys(months).length
    }
  }
  if (additions.goals) {
    for (const ch of Object.values(additions.goals)) {
      n += Object.keys(ch).length
    }
  }
  if (additions.channelDirectives) {
    n += Object.keys(additions.channelDirectives).length
  }
  if (additions.currentState) {
    if (additions.currentState.asOf) n++
    if (additions.currentState.gap) n++
    if (additions.currentState.channels) n += Object.keys(additions.currentState.channels).length
  }
  if (additions.authorityLayer) {
    const al = additions.authorityLayer
    if (al.coreShift) n++
    if (al.positioning) n++
    if (al.california) n++
    if (al.reportSystem) n++
    n += al.q3Events?.length ?? 0
    n += al.measurement?.length ?? 0
  }
  return n
}

// Apply user-curated additions on top of the current snapshot. Only TOP-UP
// — never replace. Scalars are written only if currently empty (mirrors
// the analyzer's gating). Arrays append; objects key-merge.
export function mergeAdditions(
  current: StrategySnapshot,
  additions: StrategyAdditions,
): StrategySnapshot {
  const out: StrategySnapshot = {
    budget: JSON.parse(JSON.stringify(current.budget ?? {})),
    goals: JSON.parse(JSON.stringify(current.goals ?? {})),
    channelDirectives: JSON.parse(JSON.stringify(current.channelDirectives ?? {})),
    currentState: JSON.parse(JSON.stringify(current.currentState ?? {})),
    authorityLayer: JSON.parse(JSON.stringify(current.authorityLayer ?? {})),
  }

  if (additions.budget) {
    for (const [month, channels] of Object.entries(additions.budget)) {
      out.budget[month] ??= {}
      for (const [channel, item] of Object.entries(channels)) {
        if (out.budget[month][channel]) continue // safety: never overwrite
        out.budget[month][channel] = item
      }
    }
  }

  if (additions.goals) {
    for (const [channel, metrics] of Object.entries(additions.goals)) {
      out.goals[channel] ??= {}
      for (const [metric, item] of Object.entries(metrics)) {
        if (out.goals[channel][metric]) continue
        out.goals[channel][metric] = item
      }
    }
  }

  if (additions.channelDirectives) {
    for (const [channel, directive] of Object.entries(additions.channelDirectives)) {
      if (out.channelDirectives[channel]) continue
      out.channelDirectives[channel] = directive
    }
  }

  if (additions.currentState) {
    out.currentState ??= {}
    if (additions.currentState.asOf && !out.currentState.asOf) {
      out.currentState.asOf = additions.currentState.asOf
    }
    if (additions.currentState.gap && !out.currentState.gap) {
      out.currentState.gap = additions.currentState.gap
    }
    if (additions.currentState.channels) {
      out.currentState.channels ??= {}
      for (const [channel, data] of Object.entries(additions.currentState.channels)) {
        if (out.currentState.channels[channel]) continue
        out.currentState.channels[channel] = data
      }
    }
  }

  if (additions.authorityLayer) {
    out.authorityLayer ??= {}
    const al = additions.authorityLayer
    if (al.coreShift && !out.authorityLayer.coreShift) out.authorityLayer.coreShift = al.coreShift
    if (al.positioning && !out.authorityLayer.positioning) out.authorityLayer.positioning = al.positioning
    if (al.california && !out.authorityLayer.california) out.authorityLayer.california = al.california
    if (al.reportSystem && !out.authorityLayer.reportSystem) out.authorityLayer.reportSystem = al.reportSystem
    if (al.q3Events && al.q3Events.length > 0) {
      out.authorityLayer.q3Events = [...(out.authorityLayer.q3Events ?? []), ...al.q3Events]
    }
    if (al.measurement && al.measurement.length > 0) {
      out.authorityLayer.measurement = [...(out.authorityLayer.measurement ?? []), ...al.measurement]
    }
  }

  return out
}
