import { z } from 'zod'

import type { RawSessionEvent } from '../../types.js'
import { StringOrTextBlocks } from '../string-or-text-blocks.js'

type ActionEvent = Extract<RawSessionEvent, { kind: 'action' }>

const EntrySchema = z.object({
  type: z.literal('message'),
  message: z.unknown(),
})

const UserMessageSchema = z.object({
  role: z.literal('user'),
  content: StringOrTextBlocks,
})

const ToolCallSchema = z.object({
  type: z.literal('toolCall'),
  id: z.string(),
  name: z.string(),
  arguments: z.unknown(),
})

const AssistantMessageSchema = z.object({
  role: z.literal('assistant'),
  content: z.array(z.unknown()),
})

const ToolResultMessageSchema = z.object({
  role: z.literal('toolResult'),
  toolCallId: z.string(),
  content: StringOrTextBlocks,
})

/**
 * Source pi's recent session activity as vendor-shaped events. pi's
 * session is a tree of entries; callers pass the active branch
 * (`ctx.sessionManager.getBranch()`), the in-memory analogue of the
 * transcript file every other vendor reads. User text becomes a prompt,
 * an assistant `toolCall` block becomes an action, and a matching
 * `toolResult` fills that action's output. Unmodeled entries and roles
 * are skipped rather than failing the read.
 */
export function rawEventsFromEntries(
  entries: readonly unknown[],
): RawSessionEvent[] {
  const pending = new Map<string, ActionEvent>()
  const emitted: RawSessionEvent[] = []

  for (const raw of entries) {
    const entry = EntrySchema.safeParse(raw)
    if (!entry.success) continue
    const message = entry.data.message

    const user = UserMessageSchema.safeParse(message)
    if (user.success) {
      if (user.data.content) {
        emitted.push({ kind: 'prompt', text: user.data.content })
      }
      continue
    }

    const assistant = AssistantMessageSchema.safeParse(message)
    if (assistant.success) {
      for (const block of assistant.data.content) {
        const call = ToolCallSchema.safeParse(block)
        if (!call.success) continue
        const action: ActionEvent = {
          kind: 'action',
          tool: call.data.name,
          input: call.data.arguments,
          output: '',
          toolUseId: call.data.id,
        }
        pending.set(call.data.id, action)
        emitted.push(action)
      }
      continue
    }

    const result = ToolResultMessageSchema.safeParse(message)
    if (result.success) {
      const action = pending.get(result.data.toolCallId)
      if (action) action.output = result.data.content
    }
  }

  return emitted
}
