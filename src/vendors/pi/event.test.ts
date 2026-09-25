import { describe, expect, it } from 'vitest'

import { toCanonical } from './event.js'

describe('toCanonical (pi)', () => {
  it('passes prompt events through unchanged', () => {
    expect(toCanonical({ kind: 'prompt', text: 'hi' })).toEqual({
      kind: 'prompt',
      text: 'hi',
    })
  })

  it('classifies a bash action as a command event', () => {
    expect(
      toCanonical({
        kind: 'action',
        tool: 'bash',
        input: { command: 'npm test' },
        output: 'PASS',
        toolUseId: 'c1',
      }),
    ).toEqual({ kind: 'command', command: 'npm test', output: 'PASS' })
  })

  it('classifies a write action as a write event', () => {
    expect(
      toCanonical({
        kind: 'action',
        tool: 'write',
        input: { path: '/abs/src/calc.ts', content: 'export const x = 1' },
        output: 'Written',
        toolUseId: 'c2',
      }),
    ).toEqual({
      kind: 'write',
      path: '/abs/src/calc.ts',
      content: 'export const x = 1',
      output: 'Written',
    })
  })

  it('classifies an edit action as a write event using the new text', () => {
    expect(
      toCanonical({
        kind: 'action',
        tool: 'edit',
        input: {
          path: '/abs/src/calc.ts',
          edits: [
            { oldText: 'a', newText: 'b' },
            { oldText: 'c', newText: 'd' },
          ],
        },
        output: 'Edited',
        toolUseId: 'c3',
      }),
    ).toEqual({
      kind: 'write',
      path: '/abs/src/calc.ts',
      content: 'b\nd',
      output: 'Edited',
    })
  })

  it('classifies an unrecognized tool as other, preserving raw input', () => {
    expect(
      toCanonical({
        kind: 'action',
        tool: 'read',
        input: { path: 'a.ts' },
        output: 'contents',
        toolUseId: 'c4',
      }),
    ).toEqual({
      kind: 'other',
      tool: 'read',
      input: { path: 'a.ts' },
      output: 'contents',
    })
  })
})
