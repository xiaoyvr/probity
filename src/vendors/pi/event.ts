import type { RawSessionEvent, SessionEvent } from '../../types.js'

export function toCanonical(event: RawSessionEvent): SessionEvent {
  if (event.kind === 'prompt') return event
  switch (event.tool) {
    case 'bash': {
      const { command } = event.input as { command: string }
      return { kind: 'command', command, output: event.output }
    }
    case 'write': {
      const { path, content } = event.input as { path: string; content: string }
      return { kind: 'write', path, content, output: event.output }
    }
    case 'edit': {
      const { path, edits } = event.input as {
        path: string
        edits: { newText: string }[]
      }
      return {
        kind: 'write',
        path,
        content: edits.map((edit) => edit.newText).join('\n'),
        output: event.output,
      }
    }
    default:
      return {
        kind: 'other',
        tool: event.tool,
        input: event.input,
        output: event.output,
      }
  }
}
