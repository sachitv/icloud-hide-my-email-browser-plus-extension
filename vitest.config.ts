import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setupTests.ts'],
  },
  esbuild: {
    target: 'es2022',
    tsconfigRaw: {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        jsx: 'react-jsx',
        strict: true,
        resolveJsonModule: true,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        useUnknownInCatchVariables: false,
        allowJs: false,
      },
    },
  },
})
