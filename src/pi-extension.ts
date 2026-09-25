import type { PiCommandContext, PiExtensionAPI } from './vendors/pi/pi-api.js'

type Status = 'off' | 'on'

/**
 * pi extension entry point. Registers the `/probity` command. State is
 * in-memory and scoped to the extension runtime, so a new session (or
 * `/reload`) starts disabled. Enforcement is wired in later slices.
 */
export default function piExtension(pi: PiExtensionAPI): void {
  let status: Status = 'off'

  pi.registerCommand('probity', {
    description: 'Probity guardrails. Usage: /probity on|off',
    handler: (args, ctx) => {
      const command = args.trim()
      if (command === 'on') status = 'on'
      else if (command === 'off') status = 'off'
      notify(ctx, `Probity: ${status}`)
    },
  })
}

function notify(ctx: PiCommandContext, message: string): void {
  if (ctx.hasUI) ctx.ui.notify(message, 'info')
}
