import type { Agent } from '../../types.js'
import { toVerdict } from '../to-verdict.js'
import type { PiModelRegistry } from './pi-api.js'

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
        return { text: textOf(response.content) }
      }),
  }
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
