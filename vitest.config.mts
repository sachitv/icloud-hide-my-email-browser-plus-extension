import { defineConfig } from 'vitest/config';

const arrayBufferResizableDescriptor = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  'resizable'
);
if (arrayBufferResizableDescriptor?.get === undefined) {
  Object.defineProperty(ArrayBuffer.prototype, 'resizable', {
    configurable: true,
    get() {
      return false;
    },
  });
}

if (typeof SharedArrayBuffer !== 'undefined') {
  const sharedArrayBufferGrowableDescriptor = Object.getOwnPropertyDescriptor(
    SharedArrayBuffer.prototype,
    'growable'
  );
  if (sharedArrayBufferGrowableDescriptor?.get === undefined) {
    Object.defineProperty(SharedArrayBuffer.prototype, 'growable', {
      configurable: true,
      get() {
        return false;
      },
    });
  }
}

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setupTests.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.d.ts',
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
        global: {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
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
