import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const resolvePath = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@core': resolvePath('./src/core'),
      '@data': resolvePath('./src/data'),
      '@design': resolvePath('./src/design'),
      '@features': resolvePath('./src/features'),
      '@app': resolvePath('./src/app'),
    },
  },
  server: {
    port: 5180,
    // Tauri's dev window points at this exact port, so moving to another one on
    // a clash would leave it staring at nothing. Fail loudly instead.
    strictPort: true,
    // Needed so an iPad on the same Wi-Fi can load the dev server by IP.
    host: false,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    // Pure engine and persistence tests run in node; component tests opt into
    // jsdom with a `@vitest-environment jsdom` comment.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
