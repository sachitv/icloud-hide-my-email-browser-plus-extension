# SonarQube Issue Report

## Resolved This Iteration

- css:S4667 — src/pages/Options/Options.css: Populated the stylesheet with shared focus styles to avoid shipping an empty asset.
- css:S4667 — src/pages/Userguide/Userguide.css: Removed the unused stylesheet from the bundle.
- typescript:S7762 — tests/contentScript.test.ts:588: Replaced `removeChild` usage with `Node.remove()` for the temporary text node.
- typescript:S6643 — tests/contentScript.test.ts:879 & 909: Swapped prototype augmentation with a scoped spy on `Array.prototype.find`.
- typescript:S6643 — tests/contentScript.test.ts:18 & 32: Dropped the ArrayBuffer and SharedArrayBuffer prototype shims.
- typescript:S6643 — vitest.config.mts:8 & 22: Removed prototype mutations from the Vitest configuration setup.
- css:S7924 — src/pages/Options/index.css, src/pages/Popup/index.css, src/pages/Userguide/index.css: Declared the base background color explicitly to support Sonar's contrast check against the gradient.
- typescript:S6772 — src/pages/Popup/Popup.tsx:96: Added explicit JSX whitespace after the `Link` component to keep the sentence spacing obvious.
- javascript:S7785 — utils/checkLicenses.mjs:236: Replaced the async wrapper with top-level await and structured error handling.
- javascript:S7785 — utils/generateLicenseTable.mjs:132: Converted the script to use top-level await while preserving existing logging.
- typescript:S6544 — src/pages/Content/script.ts:247 & 252: Wrapped the reservation request in an internal async helper so the event listener stays synchronous.

## Major Issues

### typescript:S6772 — src/pages/Userguide/Userguide.tsx:90
- Line 90: Ambiguous spacing after previous element span.
#### Suggested Resolution
- Insert explicit JSX whitespace (`{' '}`) or a comment break to signal intentional spacing.

### typescript:S6772 — src/pages/Userguide/Userguide.tsx:141
- Line 141: Ambiguous spacing after previous element span.
#### Suggested Resolution
- Declare the spacing explicitly using JSX whitespace helpers to prevent accidental text concatenation.

### typescript:S6564 — src/messages.ts:34
- Line 34: Remove this redundant type alias and replace its occurrences with `GenerationResponseData`.
#### Suggested Resolution
- Inline the referenced type and delete the alias to reduce indirection and improve readability.

### typescript:S6479 — src/pages/Popup/Popup.tsx:746
- Line 746: Do not use array index in keys.
#### Suggested Resolution
- Provide a stable identifier (e.g., alias ID) for the list key instead of the iteration index.

### typescript:S4043 — src/pages/Popup/Popup.tsx:816
- Line 816: Move this array `sort` operation to a separate statement or replace it with `toSorted`.
#### Suggested Resolution
- Use non-mutating `toSorted()` or clone before sorting so intent is clear and side effects are explicit.

## Minor Issues

### typescript:S4325 — tests/contentScript.test.ts:457-459
- Lines 457-459: This assertion is unnecessary since it does not change the type of the expression.
#### Suggested Resolution
- Remove the redundant assertion or non-null cast and rely on the compiler’s inferred type.

### typescript:S4325 — tests/contentScript.test.ts:757-759
- Lines 757-759: This assertion is unnecessary since it does not change the type of the expression.
#### Suggested Resolution
- Drop the superfluous type assertion to keep the test readable and type-safe.

### typescript:S4325 — tests/contentScript.test.ts:800-802
- Lines 800-802: This assertion is unnecessary since it does not change the type of the expression.
#### Suggested Resolution
- Delete the redundant non-null assertion and keep the inferred type instead.

### typescript:S4325 — tests/contentScript.test.ts:863-865
- Lines 863-865: This assertion is unnecessary since it does not change the type of the expression.
#### Suggested Resolution
- Remove the cast to let TypeScript enforce the correct type automatically.

### typescript:S4325 — tests/contentScript.test.ts:940-942
- Lines 940-942: This assertion is unnecessary since it does not change the type of the expression.
#### Suggested Resolution
- Simplify the assertion away and rely on type narrowing within the test.

### typescript:S4325 — tests/contentScript.test.ts:678-680
- Lines 678-680: This assertion is unnecessary since it does not change the type of the expression.
#### Suggested Resolution
- Eliminate the redundant cast so the expression uses inferred types.

### typescript:S7764 — tests/contentScript.test.ts:57
- Line 57: Prefer `globalThis` over `window`.
#### Suggested Resolution
- Swap `window` for `globalThis` to keep the code runtime-agnostic.

### typescript:S7764 — tests/contentScript.test.ts:60
- Line 60: Prefer `globalThis` over `window`.
#### Suggested Resolution
- Use `globalThis` to support non-browser environments in tests.

### typescript:S7764 — tests/contentScript.test.ts:705
- Line 705: Prefer `globalThis` over `window`.
#### Suggested Resolution
- Replace `window` usage with `globalThis` for environment portability.

### typescript:S7764 — tests/popup.test.tsx:140
- Line 140: Prefer `globalThis` over `window`.
#### Suggested Resolution
- Update the global reference to `globalThis` so the test suite runs in any JS runtime.

### typescript:S7764 — tests/popup.test.tsx:152
- Line 152: Prefer `globalThis` over `window`.
#### Suggested Resolution
- Switch the global access to `globalThis` for cross-platform support.

### typescript:S7764 — tests/popup.test.tsx:154
- Line 154: Prefer `globalThis` over `window`.
#### Suggested Resolution
- Reference `globalThis` instead of `window` to avoid browser-only globals.

### typescript:S7764 — tests/popup.test.tsx:193
- Line 193: Prefer `globalThis` over `window`.
#### Suggested Resolution
- Replace `window` with `globalThis` so the tests are environment-agnostic.

### typescript:S7764 — src/pages/Content/script.ts:238
- Line 238: Prefer `globalThis` over `window`.
#### Suggested Resolution
- Use `globalThis` so the content script remains compatible across runtime contexts.

### javascript:S2486 — utils/checkLicenses.mjs:107-109
- Lines 107-109: Handle this exception or don't catch it at all.
#### Suggested Resolution
- Log, rethrow, or otherwise handle the caught error instead of silently swallowing it.

### javascript:S2486 — utils/generateLicenseTable.mjs:92-94
- Lines 92-94: Handle this exception or don't catch it at all.
#### Suggested Resolution
- Add concrete error handling (log, rethrow, or recover) to the catch block rather than leaving it empty.

### typescript:S7732 — src/hooks.ts:41
- Line 41: Avoid using `instanceof` for type checking as it can lead to unreliable results.
#### Suggested Resolution
- Replace `instanceof` on built-ins with safer checks such as `typeof` or `Array.isArray`.

### typescript:S7737 — src/iCloudClient.ts:69
- Line 69: Do not use an object literal as default for parameter `options`.
#### Suggested Resolution
- Destructure the parameter with individual defaults (`({ foo = ... } = {})`) instead of supplying an object literal default.

### typescript:S7735 — src/iCloudClient.ts:27
- Line 27: Unexpected negated condition.
#### Suggested Resolution
- Invert the condition and swap the branches so the `if` clause expresses the positive case.

### typescript:S7728 — src/pages/Content/script.ts:126
- Line 126: Use `for…of` instead of `.forEach(…)`.
#### Suggested Resolution
- Rewrite the iteration with a `for…of` loop to improve control flow and async handling.

### typescript:S7728 — src/pages/Content/script.ts:142
- Line 142: Use `for…of` instead of `.forEach(…)`.
#### Suggested Resolution
- Replace the `forEach` call with a `for…of` loop for clearer flow and better async support.

### typescript:S6754 — src/pages/Userguide/Userguide.tsx:102
- Line 102: `useState` call is not destructured into value + setter pair.
#### Suggested Resolution
- Rename the hook result to `[value, setValue]` style identifiers to keep state and setter paired.

## Info Issues

### typescript:S1135 — src/pages/Popup/Popup.tsx:250
- Line 250: Complete the task associated to this `TODO` comment.
#### Suggested Resolution
- Resolve the outstanding TODO or convert it into a tracked work item so the code no longer carries the placeholder.

### typescript:S1135 — src/storage.ts:16
- Line 16: Complete the task associated to this `TODO` comment.
#### Suggested Resolution
- Address the noted TODO or link it to a backlog item, then remove the in-code reminder.
