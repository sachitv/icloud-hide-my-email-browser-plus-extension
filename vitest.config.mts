import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: [
      'tests/e2e/**',
      'node_modules/**',
      'dist/**',
      '.idea/**',
      '.git/**',
      '.cache/**',
    ],
    setupFiles: ['tests/setupTests.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.d.ts',
        '**/*.stories.tsx',
        'src/options.ts',
        'src/pages/**/index.ts',
        'src/pages/**/index.tsx',
        'src/pages/Userguide/**',
        'wxt.config.ts',
        'tailwind.config.js',
        'postcss.config.js',
        'vitest.config.mts',
        'build/**',
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
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
});
