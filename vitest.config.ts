import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@younghoandrewchaa/yeditor': path.resolve(__dirname, 'packages/yeditor/src/index.ts'),
    },
  },
})
