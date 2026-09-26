import { findConfig, loadConfig, type Config } from './config.js'
import { evaluateActions } from './evaluate-actions.js'
import { buildRuleContext } from './rule-context.js'
import type { Decision } from './types.js'
import { piAgent } from './vendors/pi/agent.js'
import { toCanonical } from './vendors/pi/event.js'
import { renderTrace, type TraceRecord } from './vendors/pi/trace.js'
import { rawEventsFromEntries } from './vendors/pi/transcript.js'
import type {
  PiContext,
  PiExtensionAPI,
  PiToolCallResult,
} from './vendors/pi/pi-api.js'
import { toActions } from './vendors/pi/tool-call.js'

type State =
  { status: 'off' } | { status: 'on'; config: Config; trace: boolean }

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

  pi.registerEntryRenderer('probity-trace', renderTrace)

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
        appendTrace(pi, {
          tool: event.toolName,
          toolCallId: event.toolCallId,
          decision,
          trace,
        })
      }
      return toResult(decision)
    } catch (error) {
      return { block: true, reason: `Probity: ${message(error)}` }
    }
  })
}

/**
 * Append a trace entry best-effort: tracing is observability, so a
 * failure to record it must not change the decision returned to the
 * agent.
 */
function appendTrace(pi: PiExtensionAPI, record: TraceRecord): void {
  try {
    pi.appendEntry('probity-trace', record)
  } catch {
    // Ignore: a tracing failure must not affect enforcement.
  }
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
