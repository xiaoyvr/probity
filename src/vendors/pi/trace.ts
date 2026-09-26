import type { Decision, TraceEntry } from '../../types.js'
import type {
  PiComponent,
  PiCustomEntry,
  PiEntryRenderOptions,
} from './pi-api.js'

/** The `probity-trace` transcript entry's data: one evaluated tool call. */
export type TraceRecord = {
  tool: string
  toolCallId: string
  decision: Decision
  trace: readonly TraceEntry[]
}

/**
 * Renders a `probity-trace` entry: one summary line and one line per
 * evaluated rule; expanded entries add each AI validator call with its
 * verdict and any vendor telemetry. Plain text, lines capped to width.
 */
export function renderTrace(
  entry: PiCustomEntry,
  options: PiEntryRenderOptions,
): PiComponent {
  const record = entry.data as TraceRecord | undefined
  const lines = record ? formatTrace(record, options) : ['probity trace']
  return {
    render: (width: number) => lines.map((line) => truncate(line, width)),
    invalidate: () => {},
  }
}

function formatTrace(
  record: TraceRecord,
  options: PiEntryRenderOptions,
): string[] {
  const lines = [`probity trace · ${record.tool} · ${record.decision.kind}`]
  for (const entry of record.trace) {
    lines.push(`  ${formatTraceEntry(entry)}`)
    if (options.expanded) lines.push(...expandedLines(entry))
  }
  return lines
}

function formatTraceEntry(entry: TraceEntry): string {
  switch (entry.kind) {
    case 'rule-evaluated': {
      const calls = entry.agentCalls?.length ?? 0
      const ai = calls > 0 ? ` · ${calls} AI` : ''
      return `${entry.rule}  ${entry.result.kind}  ${roundMs(entry.durationMs)}ms${ai}`
    }
    case 'rule-failed':
      return `${entry.rule}  failed  ${roundMs(entry.durationMs)}ms`
    case 'parse-failed':
      return `parse-failed  ${entry.reason}`
  }
}

function expandedLines(entry: TraceEntry): string[] {
  if (entry.kind !== 'rule-evaluated') return []
  return (entry.agentCalls ?? []).map((call, index) => {
    const meta = call.verdict.meta
      ? `  ${JSON.stringify(call.verdict.meta)}`
      : ''
    return `    AI ${index + 1}: ${call.verdict.kind}  ${roundMs(call.durationMs)}ms${meta}`
  })
}

function truncate(line: string, width: number): string {
  return line.length > width ? line.slice(0, width) : line
}

function roundMs(ms: number): number {
  return Math.round(ms)
}
