import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PiToolCallEvent } from './pi-api.js'
import { piEditContent } from './pi-edit.js'
import { toActions } from './tool-call.js'

vi.mock('./pi-edit.js', () => ({ piEditContent: vi.fn() }))

const editContent = vi.mocked(piEditContent)

const write = (input: Record<string, unknown>): PiToolCallEvent => ({
  type: 'tool_call',
  toolCallId: 'call_1',
  toolName: 'write',
  input,
})

const edit = (input: Record<string, unknown>): PiToolCallEvent => ({
  type: 'tool_call',
  toolCallId: 'call_2',
  toolName: 'edit',
  input,
})

describe('toActions (pi)', () => {
  beforeEach(() => {
    editContent.mockReset()
  })

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
        toolCallId: 'call_3',
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

  it('maps an edit to a write action with the reconstructed content', async () => {
    editContent.mockResolvedValue('post-edit content')

    const actions = await toActions(
      edit({ path: 'src/calc.ts', edits: [{ oldText: 'a', newText: 'b' }] }),
      '/repo',
    )

    expect(editContent).toHaveBeenCalledWith(
      { path: 'src/calc.ts', edits: [{ oldText: 'a', newText: 'b' }] },
      '/repo',
    )
    expect(actions).toEqual([
      {
        kind: 'write',
        path: '/repo/src/calc.ts',
        content: 'post-edit content',
      },
    ])
  })

  it('fails closed on a malformed edit payload', async () => {
    await expect(toActions(edit({ path: 'a.ts' }), '/repo')).rejects.toThrow()
    expect(editContent).not.toHaveBeenCalled()
  })

  it('fails closed when the edit pipeline rejects', async () => {
    editContent.mockRejectedValue(new Error('oldText not found in a.ts'))

    await expect(
      toActions(
        edit({ path: 'a.ts', edits: [{ oldText: 'a', newText: 'b' }] }),
        '/repo',
      ),
    ).rejects.toThrow(/not found/)
  })
})
