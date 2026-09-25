import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Scope discovery to the repository's own tests. Without this,
    // vitest walks into .direnv/flake-inputs, finds the flake's own
    // source snapshot, and runs a second, broken copy of the suite.
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
})
