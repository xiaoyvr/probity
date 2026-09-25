import { defineConfig, forbidContentPattern } from '@nizos/probity'

export default defineConfig({
  rules: [
    forbidContentPattern({
      match: 'TODO',
      reason: 'No TODOs in this project',
    }),
  ],
})
