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
