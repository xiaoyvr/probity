import { findConfig, loadConfig, type Config } from './config.js'
import { evaluateActions } from './evaluate-actions.js'
import { buildRuleContext } from './rule-context.js'
import type { Decision, TraceEntry } from './types.js'
import { piAgent } from './vendors/pi/agent.js'
import { toCanonical } from './vendors/pi/event.js'
import { rawEventsFromEntries } from './vendors/pi/transcript.js'
import type {
  PiContext,
  PiEntryRenderOptions,
  PiExtensionAPI,
  PiToolCallResult,
} from './vendors/pi/pi-api.js'
import { toActions } from './vendors/pi/tool-call.js'

type State =
  { status: 'off' } | { status: 'on'; config: Config; trace: boolean }

/** The `probity-trace` transcript entry's data: one evaluated tool call. */
type TraceRecord = {
  tool: string
  toolCallId: string
  decision: Decision
  trace: readonly TraceEntry[]
}

/**
 * pi extension entry point. Registers `/probity` and evaluates tool
 * calls while enabled. State is in-memory and scoped to the extension
 * runtime, so a new session (or `/reload`) starts disabled.
 */
export default function piExtension(pi: PiExtensionAPI): void {
  let state: State = { status: 'off' }

  async function enable(ctx: PiContext): Promise<void> {
    try {
      const config = await loadConfig(findConfig(ctx.cwd))
      state = { status: 'on', config, trace: false }
      notify(ctx, 'Probity: on')
    } catch (error) {
      state = { status: 'off' }
      notify(ctx, `Probity: ${message(error)}`, 'error')
    }
  }

  pi.registerCommand('probity', {
    description: 'Probity guardrails. Usage: /probity on|off|trace',
    handler: async (args, ctx) => {
      const command = args.trim()
      if (command === 'on') {
        await enable(ctx)
      } else if (command === 'off') {
        state = { status: 'off' }
        notify(ctx, 'Probity: off')
      } else if (command === 'trace') {
        if (state.status !== 'on') {
          notify(ctx, 'Probity: trace is available only while on', 'error')
        } else {
          state = { ...state, trace: !state.trace }
          notify(ctx, `Probity: trace ${state.trace ? 'on' : 'off'}`)
        }
      } else {
        notify(ctx, `Probity: ${state.status}`)
      }
    },
  })

  pi.registerEntryRenderer('probity-trace', (entry, options) =>
    renderTrace(entry.data as TraceRecord | undefined, options),
  )

  pi.on('tool_call', async (event, ctx) => {
    if (state.status !== 'on') return undefined
    const { config, trace: tracing } = state
    const agent = config.ai ?? piAgent(ctx)
    try {
      const { decision, trace } = await evaluateActions(
        await toActions(event, ctx.cwd),
        {
          rules: config.rules,
          agent,
          contextFor: (wrapped) =>
            buildRuleContext({
              agent: wrapped,
              rawHistory: () =>
                Promise.resolve(
                  rawEventsFromEntries(ctx.sessionManager.getBranch()),
                ),
              toCanonical,
            }),
        },
      )
      if (tracing && trace.length > 0) {
        pi.appendEntry('probity-trace', {
          tool: event.toolName,
          toolCallId: event.toolCallId,
          decision,
          trace,
        } satisfies TraceRecord)
      }
      return toResult(decision)
    } catch (error) {
      return { block: true, reason: `Probity: ${message(error)}` }
    }
  })
}

/**
 * Renders a `probity-trace` entry: one summary line and one line per
 * evaluated rule; expanded entries add each AI validator call with its
 * verdict and any vendor telemetry. Plain text, lines capped to width.
 */
function renderTrace(
  data: TraceRecord | undefined,
  options: PiEntryRenderOptions,
) {
  const lines = data ? formatTrace(data, options) : ['probity trace']
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

function toResult(decision: Decision): PiToolCallResult {
  return decision.kind === 'block'
    ? { block: true, reason: `Probity: ${decision.reason}` }
    : undefined
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function notify(
  ctx: PiContext,
  text: string,
  type: 'info' | 'warning' | 'error' = 'info',
): void {
  if (ctx.hasUI) ctx.ui.notify(text, type)
}
