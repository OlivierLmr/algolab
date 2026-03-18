/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/algolab/',
  plugins: [preact()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
