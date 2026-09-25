import type { Action } from '../../types.js'
import { posixAbsolute } from '../posix-absolute.js'
import type { PiToolCallEvent } from './pi-api.js'

/**
 * Translate a pi tool-call event into canonical Actions. Tools Probity
 * does not model (read, grep, find, ls, custom, and — for now — bash
 * and edit) yield no actions; the caller passes them through. A
 * malformed known tool throws so the caller can fail closed.
 */
export function toActions(
  event: PiToolCallEvent,
  cwd: string,
): Promise<Action[]> {
  if (event.toolName !== 'write') return Promise.resolve([])
  const { path: filePath, content } = event.input
  if (typeof filePath !== 'string' || typeof content !== 'string') {
    return Promise.reject(
      new Error('write tool call is missing a string path or content'),
    )
  }
  return Promise.resolve([
    { kind: 'write', path: posixAbsolute(cwd, filePath), content },
  ])
}
