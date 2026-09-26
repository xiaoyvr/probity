import { describe, expect, it } from 'vitest'

import { renderTrace, type TraceRecord } from './trace.js'

function render(data: TraceRecord, expanded: boolean, width = 200): string {
  return renderTrace({ customType: 'probity-trace', data }, { expanded })
    .render(width)
    .join('\n')
}

describe('renderTrace', () => {
  it('renders the tool, decision and each evaluated rule', () => {
    const text = render(
      {
        tool: 'write',
        toolCallId: 'call_1',
        decision: { kind: 'block', reason: 'No TODOs' },
        trace: [
          {
            kind: 'rule-evaluated',
            rule: 'forbidContentPattern',
            result: { kind: 'violation', reason: 'No TODOs' },
            durationMs: 3,
          },
        ],
      },
      false,
    )

    expect(text).toContain('write')
    expect(text).toContain('block')
    expect(text).toContain('forbidContentPattern')
    expect(text).toContain('violation')
  })

  it('adds each AI call with its verdict and telemetry when expanded', () => {
    const text = render(
      {
        tool: 'write',
        toolCallId: 'call_1',
        decision: { kind: 'allow' },
        trace: [
          {
            kind: 'rule-evaluated',
            rule: 'enforceTdd',
            result: { kind: 'pass' },
            durationMs: 412,
            agentCalls: [
              {
                durationMs: 400,
                verdict: {
                  kind: 'pass',
                  reason: '',
                  meta: { model: 'test-model', outputTokens: 20 },
                },
              },
            ],
          },
        ],
      },
      true,
    )

    expect(text).toContain('AI 1')
    expect(text).toContain('test-model')
    expect(text).toContain('outputTokens')
  })

  it('caps each line to the render width', () => {
    const lines = renderTrace(
      {
        customType: 'probity-trace',
        data: {
          tool: 'write',
          toolCallId: 'call_1',
          decision: { kind: 'allow' },
          trace: [{ kind: 'parse-failed', reason: 'x'.repeat(200) }],
        },
      },
      { expanded: false },
    ).render(20)

    for (const line of lines) expect(line.length).toBeLessThanOrEqual(20)
  })
})
