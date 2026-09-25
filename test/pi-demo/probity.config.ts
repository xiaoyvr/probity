import {
  defineConfig,
  forbidCommandPattern,
  forbidContentPattern,
  requireCommand,
} from '@nizos/probity'

export default defineConfig({
  rules: [
    forbidContentPattern({
      match: 'TODO',
      reason: 'No TODOs in this project',
    }),
    forbidCommandPattern({
      match: /(?:^|[;&|])\s*echo\b/,
      reason: 'Use the write tool to create files, not echo',
    }),
    requireCommand({
      before: { kind: 'command', match: /git log/ },
      command: /git status/,
      reason: 'Run git status before git log.',
    }),
  ],
})
