import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it, vi, onTestFinished } from 'vitest'

import piExtension from './pi-extension.js'
import type {
  PiContext,
  PiExtensionAPI,
  PiToolCallContext,
  PiToolCallEvent,
  PiToolCallResult,
} from './vendors/pi/pi-api.js'
import { piEditContent } from './vendors/pi/pi-edit.js'

vi.mock('./vendors/pi/pi-edit.js', () => ({ piEditContent: vi.fn() }))

const editContent = vi.mocked(piEditContent)

const CONFIG = `import { defineConfig, forbidCommandPattern, forbidContentPattern, requireCommand } from '@nizos/probity'

export default defineConfig({
  rules: [
    forbidContentPattern({ match: 'TODO', reason: 'No TODOs' }),
    forbidCommandPattern({ match: /echo/, reason: 'No echo' }),
    requireCommand({
      before: { kind: 'command', match: /git commit/ },
      command: /npm test/,
    }),
  ],
})
`

const ENFORCE_CONFIG = `import { defineConfig, enforceTdd } from '@nizos/probity'

export default defineConfig({ rules: [enforceTdd()] })
`

const AI_OVERRIDE_CONFIG = `import { defineConfig, enforceTdd } from '@nizos/probity'

export default defineConfig({
  ai: { reason: async () => ({ kind: 'violation', reason: 'from config ai' }) },
  rules: [enforceTdd()],
})
`

type CommandHandler = (args: string, ctx: PiContext) => void | Promise<void>
type ToolHandler = (
  event: PiToolCallEvent,
  ctx: PiToolCallContext,
) => PiToolCallResult | Promise<PiToolCallResult>

function harness(options: { hasUI?: boolean } = {}) {
  let command: CommandHandler | undefined
  let tool: ToolHandler | undefined
  const pi: PiExtensionAPI = {
    registerCommand: (_name, config) => {
      command = config.handler
    },
    on: (_event, handler) => {
      tool = handler
    },
  }
  piExtension(pi)

  const notify = vi.fn()
  const complete = vi.fn()
  const context = (
    overrides: Partial<PiToolCallContext>,
  ): PiToolCallContext => ({
    cwd: process.cwd(),
    hasUI: options.hasUI ?? true,
    ui: { notify },
    sessionManager: { getBranch: () => [] },
    model: { id: 'test-model' },
    modelRegistry: { complete },
    ...overrides,
  })

  return {
    notify,
    complete,
    runCommand: (args: string, overrides: Partial<PiContext> = {}) =>
      Promise.resolve(command?.(args, context(overrides))),
    runTool: (
      event: PiToolCallEvent,
      overrides: Partial<PiToolCallContext> = {},
    ) => Promise.resolve(tool?.(event, context(overrides))),
  }
}

function writeEvent(content: string): PiToolCallEvent {
  return {
    type: 'tool_call',
    toolCallId: 'call_1',
    toolName: 'write',
    input: { path: 'notes.md', content },
  }
}

function editEvent(
  edits: readonly { oldText: string; newText: string }[],
): PiToolCallEvent {
  return {
    type: 'tool_call',
    toolCallId: 'call_edit',
    toolName: 'edit',
    input: { path: 'notes.md', edits },
  }
}

function bashEvent(command: string): PiToolCallEvent {
  return {
    type: 'tool_call',
    toolCallId: 'call_bash',
    toolName: 'bash',
    input: { command },
  }
}

/** A branch that ran `npm test` via bash, as pi would expose it. */
function branchWithTestRun(): unknown[] {
  return [
    {
      type: 'message',
      id: 'a',
      parentId: null,
      timestamp: '2026-09-25T00:00:00.000Z',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            id: 'call_test',
            name: 'bash',
            arguments: { command: 'npm test' },
          },
        ],
      },
    },
    {
      type: 'message',
      id: 'b',
      parentId: 'a',
      timestamp: '2026-09-25T00:00:01.000Z',
      message: {
        role: 'toolResult',
        toolCallId: 'call_test',
        content: [{ type: 'text', text: 'PASS' }],
      },
    },
  ]
}

/** A project dir containing a probity.config.ts. Defaults to CONFIG. */
async function projectWithConfig(config: string = CONFIG): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'probity-pi-config-'))
  onTestFinished(() => rm(dir, { recursive: true, force: true }))
  await writeFile(path.join(dir, 'probity.config.ts'), config)
  return dir
}

/** A project dir with no probity.config.ts anywhere up the tree. */
async function projectWithoutConfig(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'probity-pi-empty-'))
  onTestFinished(() => rm(dir, { recursive: true, force: true }))
  return dir
}

describe('pi extension /probity command', () => {
  it('registers a command named probity', () => {
    let name: string | undefined
    piExtension({
      registerCommand: (registeredName) => {
        name = registeredName
      },
      on: () => {},
    })

    expect(name).toBe('probity')
  })

  it('reports on after enabling with a valid config', async () => {
    const cwd = await projectWithConfig()
    const { notify, runCommand } = harness()

    await runCommand('on', { cwd })

    expect(notify).toHaveBeenCalledWith('Probity: on', 'info')
  })

  it('reports off when disabled', async () => {
    const { notify, runCommand } = harness()

    await runCommand('off')

    expect(notify).toHaveBeenLastCalledWith('Probity: off', 'info')
  })

  it('reports the current status when called with no arguments', async () => {
    const { notify, runCommand } = harness()

    await runCommand('')

    expect(notify).toHaveBeenCalledWith('Probity: off', 'info')
  })

  it('reports on for bare status after enabling', async () => {
    const cwd = await projectWithConfig()
    const { notify, runCommand } = harness()

    await runCommand('on', { cwd })
    await runCommand('', { cwd })

    expect(notify).toHaveBeenLastCalledWith('Probity: on', 'info')
  })

  it('stays off and reports the existing error when no config is found', async () => {
    const cwd = await projectWithoutConfig()
    const { notify, runCommand } = harness()

    await runCommand('on', { cwd })

    expect(notify).toHaveBeenCalledWith(
      expect.stringMatching(/not found/i),
      'error',
    )
  })

  it('does not notify when there is no UI', async () => {
    const cwd = await projectWithConfig()
    const { notify, runCommand } = harness({ hasUI: false })

    await runCommand('on', { cwd })

    expect(notify).not.toHaveBeenCalled()
  })

  it('toggles tracing with /probity trace, on then off', async () => {
    const cwd = await projectWithConfig()
    const { notify, runCommand } = harness()
    await runCommand('on', { cwd })

    await runCommand('trace')
    expect(notify).toHaveBeenLastCalledWith('Probity: trace on', 'info')

    await runCommand('trace')
    expect(notify).toHaveBeenLastCalledWith('Probity: trace off', 'info')
  })

  it('starts with tracing off after enabling', async () => {
    const cwd = await projectWithConfig()
    const { notify, runCommand } = harness()
    await runCommand('on', { cwd })

    await runCommand('trace')

    expect(notify).toHaveBeenLastCalledWith('Probity: trace on', 'info')
  })

  it('resets tracing to off when re-enabled', async () => {
    const cwd = await projectWithConfig()
    const { notify, runCommand } = harness()
    await runCommand('on', { cwd })
    await runCommand('trace')
    await runCommand('off')
    await runCommand('on', { cwd })

    await runCommand('trace')

    expect(notify).toHaveBeenLastCalledWith('Probity: trace on', 'info')
  })

  it('refuses /probity trace while off', async () => {
    const { notify, runCommand } = harness()

    await runCommand('trace')

    expect(notify).toHaveBeenCalledWith(
      'Probity: trace is available only while on',
      'error',
    )
  })
})

describe('pi extension tool_call', () => {
  beforeEach(() => {
    editContent.mockReset()
  })

  it('does not evaluate writes while off', async () => {
    const cwd = await projectWithConfig()
    const { runTool } = harness()

    const result = await runTool(writeEvent('TODO: later'), { cwd })

    expect(result).toBeUndefined()
  })

  it('blocks a write that violates a rule while on', async () => {
    const cwd = await projectWithConfig()
    const { runTool, runCommand } = harness()
    await runCommand('on', { cwd })

    const result = await runTool(writeEvent('TODO: later'), { cwd })

    expect(result).toEqual({ block: true, reason: 'Probity: No TODOs' })
  })

  it('allows a write that satisfies the rules while on', async () => {
    const cwd = await projectWithConfig()
    const { runTool, runCommand } = harness()
    await runCommand('on', { cwd })

    const result = await runTool(writeEvent('all clean'), { cwd })

    expect(result).toBeUndefined()
  })

  it('passes non-write tools through while on', async () => {
    const cwd = await projectWithConfig()
    const { runTool, runCommand } = harness()
    await runCommand('on', { cwd })

    const result = await runTool(
      {
        type: 'tool_call',
        toolCallId: 'call_2',
        toolName: 'bash',
        input: { command: 'ls' },
      },
      { cwd },
    )

    expect(result).toBeUndefined()
  })

  it('fails closed when translating a malformed write throws', async () => {
    const cwd = await projectWithConfig()
    const { runTool, runCommand } = harness()
    await runCommand('on', { cwd })

    const result = await runTool(
      {
        type: 'tool_call',
        toolCallId: 'call_3',
        toolName: 'write',
        input: { content: 'no path' },
      },
      { cwd },
    )

    expect(result).toMatchObject({ block: true })
    expect(result?.reason).toContain('Probity:')
  })

  it('blocks an edit whose reconstructed content violates a rule', async () => {
    const cwd = await projectWithConfig()
    const { runTool, runCommand } = harness()
    await runCommand('on', { cwd })
    editContent.mockResolvedValue('TODO: later')

    const result = await runTool(
      editEvent([{ oldText: 'old', newText: 'TODO: later' }]),
      { cwd },
    )

    expect(result).toEqual({ block: true, reason: 'Probity: No TODOs' })
  })

  it('allows an edit whose reconstructed content satisfies the rules', async () => {
    const cwd = await projectWithConfig()
    const { runTool, runCommand } = harness()
    await runCommand('on', { cwd })
    editContent.mockResolvedValue('all clean')

    const result = await runTool(
      editEvent([{ oldText: 'old', newText: 'clean' }]),
      { cwd },
    )

    expect(result).toBeUndefined()
  })

  it('blocks a command that violates a rule while on', async () => {
    const cwd = await projectWithConfig()
    const { runTool, runCommand } = harness()
    await runCommand('on', { cwd })

    const result = await runTool(bashEvent('echo hi'), { cwd })

    expect(result).toEqual({ block: true, reason: 'Probity: No echo' })
  })

  it('allows a command that satisfies the rules while on', async () => {
    const cwd = await projectWithConfig()
    const { runTool, runCommand } = harness()
    await runCommand('on', { cwd })

    const result = await runTool(bashEvent('ls'), { cwd })

    expect(result).toBeUndefined()
  })

  it('blocks a gated command when session history lacks the prerequisite', async () => {
    const cwd = await projectWithConfig()
    const { runTool, runCommand } = harness()
    await runCommand('on', { cwd })

    const result = await runTool(bashEvent('git commit -m x'), {
      cwd,
      sessionManager: { getBranch: () => [] },
    })

    expect(result).toMatchObject({ block: true })
  })

  it('allows a gated command when session history shows the prerequisite ran', async () => {
    const cwd = await projectWithConfig()
    const { runTool, runCommand } = harness()
    await runCommand('on', { cwd })

    const result = await runTool(bashEvent('git commit -m x'), {
      cwd,
      sessionManager: { getBranch: () => branchWithTestRun() },
    })

    expect(result).toBeUndefined()
  })

  it('blocks a write when the AI validator returns a violation', async () => {
    const cwd = await projectWithConfig(ENFORCE_CONFIG)
    const { runTool, runCommand, complete } = harness()
    await runCommand('on', { cwd })
    complete.mockResolvedValue({
      content: [
        { type: 'text', text: '{"kind":"violation","reason":"not TDD"}' },
      ],
    })

    const result = await runTool(writeEvent('export const x = 1'), { cwd })

    expect(result).toEqual({ block: true, reason: 'Probity: not TDD' })
  })

  it('allows a write when the AI validator returns a pass', async () => {
    const cwd = await projectWithConfig(ENFORCE_CONFIG)
    const { runTool, runCommand, complete } = harness()
    await runCommand('on', { cwd })
    complete.mockResolvedValue({
      content: [{ type: 'text', text: '{"kind":"pass","reason":""}' }],
    })

    const result = await runTool(writeEvent('export const x = 1'), { cwd })

    expect(result).toBeUndefined()
  })

  it('prefers a config-provided AI validator over the session model', async () => {
    const cwd = await projectWithConfig(AI_OVERRIDE_CONFIG)
    const { runTool, runCommand, complete } = harness()
    await runCommand('on', { cwd })

    const result = await runTool(writeEvent('export const x = 1'), { cwd })

    expect(result).toEqual({ block: true, reason: 'Probity: from config ai' })
    expect(complete).not.toHaveBeenCalled()
  })
})
