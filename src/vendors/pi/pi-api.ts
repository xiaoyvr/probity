/**
 * Minimal structural types for the pi extension surface Probity uses.
 * Declared locally (type-only) so Probity takes no dependency on
 * `@earendil-works/pi-coding-agent`. Field names mirror pi's extension
 * API; grow this file slice by slice as the extension needs more.
 */
export type PiExtensionAPI = {
  registerCommand(name: string, options: PiCommandRegistration): void
  on(event: 'tool_call', handler: PiToolCallHandler): void
}

export type PiCommandRegistration = {
  description?: string
  handler: (args: string, ctx: PiContext) => void | Promise<void>
}

export type PiToolCallHandler = (
  event: PiToolCallEvent,
  ctx: PiToolCallContext,
) => PiToolCallResult | Promise<PiToolCallResult>

/**
 * Fired before a pi tool executes. `input` is the tool's raw arguments;
 * the shape varies by `toolName`.
 */
export type PiToolCallEvent = {
  type: 'tool_call'
  toolCallId: string
  toolName: string
  input: Record<string, unknown>
}

/** Returning `{ block: true, reason }` prevents the tool from running. */
export type PiToolCallResult = { block: true; reason: string } | undefined

export type PiContext = {
  cwd: string
  hasUI: boolean
  ui: {
    notify(message: string, type?: 'info' | 'warning' | 'error'): void
  }
}

/** The slice of a model response the validator reads. */
export type PiAssistantMessage = {
  content: readonly unknown[]
}

/** Provider-neutral completion, as exposed on pi's model registry. */
export type PiModelRegistry = {
  complete(
    model: unknown,
    context: unknown,
    options?: unknown,
  ): Promise<PiAssistantMessage>
}

/** Tool-call handlers additionally receive the session and model access. */
export type PiToolCallContext = PiContext & {
  sessionManager: { getBranch(): unknown[] }
  model: unknown
  modelRegistry: PiModelRegistry
}
