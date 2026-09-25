import {
  defineConfig,
  forbidCommandPattern,
  forbidContentPattern,
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
  ],
})
