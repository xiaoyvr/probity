import { access, readFile } from 'node:fs/promises'

import { createEditToolDefinition } from '@earendil-works/pi-coding-agent'

export type PiEditInput = {
  path: string
  edits: readonly { oldText: string; newText: string }[]
}

/**
 * Reconstruct the content a pi `edit` call will produce, by running
 * pi's own edit pipeline with a `writeFile` that captures instead of
 * writing (ADR-0011). pi supplies the imported module to extensions and
 * rewrites the import to its own instance at runtime; see
 * `pi-coding-agent.d.ts` and the ADR for why the import is static and
 * the type local.
 */
export async function piEditContent(
  input: PiEditInput,
  cwd: string,
): Promise<string> {
  let captured: string | undefined
  const definition = createEditToolDefinition(cwd, {
    operations: {
      access: (filePath) => access(filePath),
      readFile: (filePath) => readFile(filePath),
      writeFile: (_filePath, content) => {
        captured = content
        return Promise.resolve()
      },
    },
  })
  await definition.execute('probity', input, undefined, undefined, { cwd })
  if (captured === undefined) {
    throw new Error('pi edit pipeline produced no content')
  }
  return captured
}
