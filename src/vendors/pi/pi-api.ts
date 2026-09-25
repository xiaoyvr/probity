/**
 * Minimal structural types for the pi extension surface Probity uses.
 * Declared locally (type-only) so Probity takes no dependency on
 * `@earendil-works/pi-coding-agent`. Field names mirror pi's extension
 * API; grow this file slice by slice as the extension needs more.
 */
export type PiExtensionAPI = {
  registerCommand(name: string, options: PiCommandRegistration): void
}

export type PiCommandRegistration = {
  description?: string
  handler: (args: string, ctx: PiCommandContext) => void | Promise<void>
}

export type PiCommandContext = {
  hasUI: boolean
  ui: {
    notify(message: string, type?: 'info' | 'warning' | 'error'): void
  }
}
