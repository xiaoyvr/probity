import { createAgentCallCollector } from './agent-call-collector.js'
import type { RuleEntry } from './config.js'
import { evaluate } from './engine.js'
import type { RuleContext } from './rules/contract.js'
import type { Action, Agent, Decision, TraceEntry } from './types.js'

/**
 * Evaluate a batch of actions against the rules. Uses a fresh agent-call
 * collector per action so AI-call attribution stays scoped to the action
 * that made the call, and short-circuits on the first block so no action
 * in the batch escapes the rules. Shared by the cli dispatch and the pi
 * extension so the loop and its scoping invariant live in one place.
 */
export async function evaluateActions(
  actions: readonly Action[],
  options: {
    rules: readonly RuleEntry[]
    agent: Agent
    contextFor: (agent: Agent) => RuleContext
  },
): Promise<{ decision: Decision; trace: readonly TraceEntry[] }> {
  const trace: TraceEntry[] = []
  for (const action of actions) {
    const collector = createAgentCallCollector(options.agent)
    const outcome = await evaluate(
      action,
      options.rules,
      options.contextFor(collector.agent),
      collector.hooks,
    )
    trace.push(...collector.enrichTrace(outcome.trace))
    if (outcome.decision.kind === 'block') {
      return { decision: outcome.decision, trace }
    }
  }
  return { decision: { kind: 'allow' }, trace }
}
