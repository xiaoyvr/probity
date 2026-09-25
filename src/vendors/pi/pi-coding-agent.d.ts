/**
 * Minimal ambient declaration for the one pi API Probity calls.
 *
 * pi supplies `@earendil-works/pi-coding-agent` to extensions at runtime
 * and rewrites a static import of it through its loader (see ADR-0011).
 * Declaring the module locally keeps the package out of Probity's
 * dependency graph while letting `tsc` resolve the import for the build.
 */
declare module '@earendil-works/pi-coding-agent' {
  export type PiEditOperations = {
    access: (path: string) => Promise<void>
    readFile: (path: string) => Promise<Buffer>
    writeFile: (path: string, content: string) => Promise<void>
  }

  export type PiToolDefinition = {
    execute: (
      toolCallId: string,
      input: unknown,
      signal: AbortSignal | undefined,
      onUpdate: undefined,
      ctx: { cwd: string },
    ) => Promise<unknown>
  }

  export function createEditToolDefinition(
    cwd: string,
    options?: { operations?: PiEditOperations },
  ): PiToolDefinition
}
