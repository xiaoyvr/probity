import { findConfig, loadConfig, type Config } from './config.js'
import { evaluate } from './engine.js'
import type { Decision } from './types.js'
import type {
  PiContext,
  PiExtensionAPI,
  PiToolCallResult,
} from './vendors/pi/pi-api.js'
import { toActions } from './vendors/pi/tool-call.js'

type State = { status: 'off' } | { status: 'on'; config: Config }

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
      state = { status: 'on', config }
      notify(ctx, 'Probity: on')
    } catch (error) {
      state = { status: 'off' }
      notify(ctx, `Probity: ${message(error)}`, 'error')
    }
  }

  pi.registerCommand('probity', {
    description: 'Probity guardrails. Usage: /probity on|off',
    handler: async (args, ctx) => {
      const command = args.trim()
      if (command === 'on') {
        await enable(ctx)
      } else if (command === 'off') {
        state = { status: 'off' }
        notify(ctx, 'Probity: off')
      } else {
        notify(ctx, `Probity: ${state.status}`)
      }
    },
  })

  pi.on('tool_call', async (event, ctx) => {
    if (state.status !== 'on') return undefined
    const { rules } = state.config
    try {
      for (const action of await toActions(event, ctx.cwd)) {
        const { decision } = await evaluate(action, rules)
        const result = toResult(decision)
        if (result) return result
      }
      return undefined
    } catch (error) {
      return { block: true, reason: `Probity: ${message(error)}` }
    }
  })
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
