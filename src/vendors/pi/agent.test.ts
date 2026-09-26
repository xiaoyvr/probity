import { beforeEach, describe, expect, it, vi } from 'vitest'

import { piAgent } from './agent.js'

const complete = vi.fn()
const modelRegistry = { complete }

const respond = (text: string | readonly unknown[]) =>
  complete.mockResolvedValue({
    content: typeof text === 'string' ? [{ type: 'text', text }] : [...text],
  })

describe('piAgent', () => {
  beforeEach(() => {
    complete.mockReset()
  })

  it('parses a pass verdict from the model response', async () => {
    respond('{"kind":"pass","reason":""}')
    const agent = piAgent({ model: { id: 'm' }, modelRegistry })

    expect(await agent.reason('prompt')).toEqual({ kind: 'pass', reason: '' })
  })

  it('parses a violation verdict from the model response', async () => {
    respond('{"kind":"violation","reason":"not TDD"}')
    const agent = piAgent({ model: { id: 'm' }, modelRegistry })

    expect(await agent.reason('prompt')).toEqual({
      kind: 'violation',
      reason: 'not TDD',
    })
  })

  it('joins text content blocks before parsing', async () => {
    respond([
      { type: 'text', text: '{"kind":"violation",' },
      { type: 'text', text: '"reason":"split"}' },
    ])
    const agent = piAgent({ model: { id: 'm' }, modelRegistry })

    expect(await agent.reason('prompt')).toEqual({
      kind: 'violation',
      reason: 'split',
    })
  })

  it('attaches the model and token usage as meta', async () => {
    complete.mockResolvedValue({
      content: [{ type: 'text', text: '{"kind":"pass","reason":""}' }],
      model: 'claude-sonnet-4',
      usage: { input: 100, output: 20, cacheRead: 5, cacheWrite: 3 },
    })
    const agent = piAgent({ model: { id: 'm' }, modelRegistry })

    const verdict = await agent.reason('prompt')

    expect(verdict).toEqual({
      kind: 'pass',
      reason: '',
      meta: {
        model: 'claude-sonnet-4',
        inputTokens: 100,
        outputTokens: 20,
        cacheReadTokens: 5,
        cacheWriteTokens: 3,
      },
    })
  })

  it('reports only the usage fields the response carries', async () => {
    complete.mockResolvedValue({
      content: [{ type: 'text', text: '{"kind":"pass","reason":""}' }],
      usage: { output: 42 },
    })
    const agent = piAgent({ model: { id: 'm' }, modelRegistry })

    const verdict = await agent.reason('prompt')

    expect(verdict.meta).toEqual({ outputTokens: 42 })
  })

  it('omits meta when the response carries no usage or model', async () => {
    respond('{"kind":"pass","reason":""}')
    const agent = piAgent({ model: { id: 'm' }, modelRegistry })

    const verdict = await agent.reason('prompt')

    expect(verdict.meta).toBeUndefined()
  })

  it('fails closed when there is no active model', async () => {
    const agent = piAgent({ model: undefined, modelRegistry })

    const verdict = await agent.reason('prompt')

    expect(verdict.kind).toBe('violation')
    expect(complete).not.toHaveBeenCalled()
  })

  it('fails closed when the model call rejects', async () => {
    complete.mockRejectedValue(new Error('provider unavailable'))
    const agent = piAgent({ model: { id: 'm' }, modelRegistry })

    const verdict = await agent.reason('prompt')

    expect(verdict.kind).toBe('violation')
    expect(verdict.reason).toMatch(/provider unavailable/)
  })
})
