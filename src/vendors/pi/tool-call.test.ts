import { describe, expect, it } from 'vitest'

import type { PiToolCallEvent } from './pi-api.js'
import { toActions } from './tool-call.js'

const write = (input: Record<string, unknown>): PiToolCallEvent => ({
  type: 'tool_call',
  toolCallId: 'call_1',
  toolName: 'write',
  input,
})

describe('toActions (pi)', () => {
  it('maps a write to a write action with an absolute posix path', async () => {
    const actions = await toActions(
      write({ path: 'src/calc.ts', content: 'export const x = 1' }),
      '/repo',
    )

    expect(actions).toEqual([
      {
        kind: 'write',
        path: '/repo/src/calc.ts',
        content: 'export const x = 1',
      },
    ])
  })

  it('leaves an already-absolute path unchanged', async () => {
    const actions = await toActions(
      write({ path: '/elsewhere/a.ts', content: 'x' }),
      '/repo',
    )

    expect(actions).toEqual([
      { kind: 'write', path: '/elsewhere/a.ts', content: 'x' },
    ])
  })

  it('yields no actions for a tool Probity does not model yet', async () => {
    const actions = await toActions(
      {
        type: 'tool_call',
        toolCallId: 'call_2',
        toolName: 'bash',
        input: { command: 'ls' },
      },
      '/repo',
    )

    expect(actions).toEqual([])
  })

  it('fails closed on a malformed write payload', async () => {
    await expect(toActions(write({ content: 'x' }), '/repo')).rejects.toThrow()
  })
})
