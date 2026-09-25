import type { Action } from '../../types.js'
import { posixAbsolute } from '../posix-absolute.js'
import type { PiToolCallEvent } from './pi-api.js'
import { piEditContent, type PiEditInput } from './pi-edit.js'

/**
 * Translate a pi tool-call event into canonical Actions. Tools Probity
 * does not model (read, grep, find, ls, custom) yield no actions; the
 * caller passes them through. `bash` carries a command, `write` carries
 * its content directly, and `edit` carries a diff that is reconstructed
 * through pi's own edit pipeline. A malformed known tool throws so the
 * caller can fail closed.
 */
export async function toActions(
  event: PiToolCallEvent,
  cwd: string,
): Promise<Action[]> {
  if (event.toolName === 'write') {
    const { path, content } = event.input
    if (typeof path !== 'string' || typeof content !== 'string') {
      throw new Error('write tool call is missing a string path or content')
    }
    return [{ kind: 'write', path: posixAbsolute(cwd, path), content }]
  }
  if (event.toolName === 'edit') {
    const input = parseEditInput(event.input)
    const content = await piEditContent(input, cwd)
    return [{ kind: 'write', path: posixAbsolute(cwd, input.path), content }]
  }
  if (event.toolName === 'bash') {
    const { command } = event.input
    if (typeof command !== 'string') {
      throw new Error('bash tool call is missing a string command')
    }
    return [{ kind: 'command', command }]
  }
  return []
}

function parseEditInput(input: Record<string, unknown>): PiEditInput {
  const { path, edits } = input
  if (typeof path !== 'string' || !Array.isArray(edits) || edits.length === 0) {
    throw new Error(
      'edit tool call is missing a string path or a non-empty edits array',
    )
  }
  return { path, edits: edits.map(parseEditOp) }
}

function parseEditOp(edit: unknown): { oldText: string; newText: string } {
  if (
    typeof edit !== 'object' ||
    edit === null ||
    typeof (edit as { oldText?: unknown }).oldText !== 'string' ||
    typeof (edit as { newText?: unknown }).newText !== 'string'
  ) {
    throw new Error('edit tool call has a malformed edits entry')
  }
  const { oldText, newText } = edit as { oldText: string; newText: string }
  return { oldText, newText }
}
