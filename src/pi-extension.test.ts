import { describe, expect, it, vi } from 'vitest'

import piExtension from './pi-extension.js'
import type { PiCommandContext, PiExtensionAPI } from './vendors/pi/pi-api.js'

type Handler = (args: string, ctx: PiCommandContext) => void | Promise<void>

function setup(options: { hasUI?: boolean } = {}) {
  let name: string | undefined
  let handler: Handler | undefined
  const pi: PiExtensionAPI = {
    registerCommand: (registeredName, config) => {
      name = registeredName
      handler = config.handler
    },
  }
  piExtension(pi)
  const notify = vi.fn()
  const ctx: PiCommandContext = { hasUI: options.hasUI ?? true, ui: { notify } }
  return {
    name,
    notify,
    run: async (args: string) => {
      await handler?.(args, ctx)
    },
  }
}

describe('pi extension /probity command', () => {
  it('registers a command named probity', () => {
    expect(setup().name).toBe('probity')
  })

  it('reports on when enabled', async () => {
    const { notify, run } = setup()

    await run('on')

    expect(notify).toHaveBeenCalledWith('Probity: on', 'info')
  })

  it('reports off when disabled', async () => {
    const { notify, run } = setup()

    await run('on')
    await run('off')

    expect(notify).toHaveBeenLastCalledWith('Probity: off', 'info')
  })

  it('reports the current status when called with no arguments', async () => {
    const { notify, run } = setup()

    await run('')

    expect(notify).toHaveBeenCalledWith('Probity: off', 'info')
  })

  it('reports on for bare status after enabling', async () => {
    const { notify, run } = setup()

    await run('on')
    await run('')

    expect(notify).toHaveBeenLastCalledWith('Probity: on', 'info')
  })

  it('does not notify when there is no UI', async () => {
    const { notify, run } = setup({ hasUI: false })

    await run('on')

    expect(notify).not.toHaveBeenCalled()
  })
})
