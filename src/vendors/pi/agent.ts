import type { Agent } from '../../types.js'
import { toVerdict } from '../to-verdict.js'
import type { PiAssistantMessage, PiModelRegistry } from './pi-api.js'

/**
 * Build the AI validator for a pi session. It reuses the session's
 * active model through `ctx.modelRegistry`, so AI-validated rules
 * piggyback on the user's configured provider and auth instead of
 * needing a separate key. A missing model or a provider error fails
 * closed inside `toVerdict`.
 */
export function piAgent(options: {
  model: unknown
  modelRegistry: PiModelRegistry
}): Agent {
  return {
    reason: (prompt) =>
      toVerdict(async () => {
        const { model } = options
        if (model === undefined) {
          throw new Error('no active model in this pi session')
        }
        const response = await options.modelRegistry.complete(model, {
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: prompt }],
              timestamp: Date.now(),
            },
          ],
        })
        const meta = buildMeta(response)
        return meta
          ? { text: textOf(response.content), meta }
          : { text: textOf(response.content) }
      }),
  }
}

type PiMeta = {
  model?: string
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

/**
 * Vendor telemetry from the completion: which model answered and what
 * the response cost in tokens. Omitted fields are the ones the SDK did
 * not report; no meta at all when it reported nothing.
 */
function buildMeta(response: PiAssistantMessage): PiMeta | undefined {
  const meta: PiMeta = {}
  if (typeof response.model === 'string') meta.model = response.model
  const usage = response.usage
  if (usage) {
    if (typeof usage.input === 'number') meta.inputTokens = usage.input
    if (typeof usage.output === 'number') meta.outputTokens = usage.output
    if (typeof usage.cacheRead === 'number')
      meta.cacheReadTokens = usage.cacheRead
    if (typeof usage.cacheWrite === 'number') {
      meta.cacheWriteTokens = usage.cacheWrite
    }
  }
  return Object.keys(meta).length > 0 ? meta : undefined
}

function textOf(content: readonly unknown[]): string {
  return content
    .map((block) => textBlock(block))
    .filter((text): text is string => text !== undefined)
    .join('\n')
}

function textBlock(block: unknown): string | undefined {
  if (typeof block !== 'object' || block === null) return undefined
  const { type, text } = block as { type?: unknown; text?: unknown }
  return type === 'text' && typeof text === 'string' ? text : undefined
}
