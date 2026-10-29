import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Run with: npx vitest run --config worker/vitest.config.js   (the root config only covers src/)
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: { include: ['*.test.js'], environment: 'node' },
})
