import { describe, expect, it } from 'vitest'

import { rawEventsFromEntries } from './transcript.js'

const entry = (id: string, message: unknown) => ({
  type: 'message',
  id,
  parentId: null,
  timestamp: '2026-09-25T00:00:00.000Z',
  message,
})

describe('rawEventsFromEntries (pi)', () => {
  it('emits a prompt for a user message', () => {
    const events = rawEventsFromEntries([
      entry('a', { role: 'user', content: 'add a test' }),
    ])

    expect(events).toEqual([{ kind: 'prompt', text: 'add a test' }])
  })

  it('joins user content sent as text blocks', () => {
    const events = rawEventsFromEntries([
      entry('a', {
        role: 'user',
        content: [
          { type: 'text', text: 'first' },
          { type: 'image', data: 'x', mimeType: 'image/png' },
          { type: 'text', text: 'second' },
        ],
      }),
    ])

    expect(events).toEqual([{ kind: 'prompt', text: 'first\nsecond' }])
  })

  it('pairs an assistant tool call with its result output', () => {
    const events = rawEventsFromEntries([
      entry('a', {
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            id: 'c1',
            name: 'bash',
            arguments: { command: 'npm test' },
          },
        ],
      }),
      entry('b', {
        role: 'toolResult',
        toolCallId: 'c1',
        content: [{ type: 'text', text: '2 tests failed' }],
      }),
    ])

    expect(events).toEqual([
      {
        kind: 'action',
        tool: 'bash',
        input: { command: 'npm test' },
        output: '2 tests failed',
        toolUseId: 'c1',
      },
    ])
  })

  it('ignores entries and roles it does not model', () => {
    const events = rawEventsFromEntries([
      { type: 'session', id: 'header' },
      entry('a', { role: 'system', content: '' }),
      entry('b', { role: 'user', content: 'hi' }),
    ])

    expect(events).toEqual([{ kind: 'prompt', text: 'hi' }])
  })
})
