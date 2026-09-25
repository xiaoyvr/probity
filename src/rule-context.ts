import type { RuleContext } from './rules/contract.js'
import type { Agent, RawSessionEvent, SessionEvent } from './types.js'
import { safeReadCapped } from './utils/safe-read.js'

const MAX_FILE_BYTES = 1024 * 1024

/**
 * Build the `RuleContext` the engine hands to rules, composing the two
 * history views from a raw-history provider and attaching the capped
 * `readFile` capability. Shared by the CLI dispatch and the pi
 * extension so the file cap and history wiring live in one place.
 */
export function buildRuleContext(options: {
  agent: Agent
  rawHistory?: (() => Promise<RawSessionEvent[]>) | undefined
  toCanonical?: ((event: RawSessionEvent) => SessionEvent) | undefined
}): RuleContext {
  const { agent, rawHistory, toCanonical } = options
  const history =
    rawHistory && toCanonical
      ? async () => (await rawHistory()).map(toCanonical)
      : undefined
  return {
    agent,
    ...(rawHistory && { rawHistory }),
    ...(history && { history }),
    readFile: (path) => safeReadCapped(path, { maxBytes: MAX_FILE_BYTES }),
  }
}
