declare module '*.svg' {
  const value: unknown;
  export = value;
}

/**
 * Whether demo mode — the in-memory fake iCloud data behind the Options
 * "Developer" section — is compiled into this build.
 *
 * Substituted textually at build time, so `__DEMO_MODE_AVAILABLE__ && …` becomes
 * `false && …` in a release build and the bundler drops the demo UI, the toggle,
 * and `mockClient.ts` from the output. Demo mode is therefore absent from
 * release builds rather than merely hidden, and a release build ignores a
 * `mockMode` flag left in storage by a development build.
 *
 * `true` for `wxt dev`, for `--mode e2e` (`npm run build:e2e`, used by the
 * Playwright suite), and for unit tests. `false` for `wxt build`.
 * Defined in `wxt.config.ts` and `vitest.config.mts`; enforced against the
 * shipped artifact by `utils/checkReleaseBuild.mjs`.
 */
declare const __DEMO_MODE_AVAILABLE__: boolean;
