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
- typescript:S6772 — src/pages/Userguide/Userguide.tsx:90 & 141: Moved punctuation inside the emphasized spans and added explicit whitespace before the following sentence.
- typescript:S6564 — src/messages.ts:34: Removed the redundant `ReservationResponseData` alias in favor of `GenerationResponseData`.
- typescript:S6479 — src/pages/Popup/Popup.tsx:746: Swapped the list key to use each email's `anonymousId`.
- typescript:S4043 — src/pages/Popup/Popup.tsx:816: Cloned the fetched aliases before sorting so the original response remains untouched.
- typescript:S4325 — tests/contentScript.test.ts:457-942: Removed redundant casts by leaning on the existing type guards.
- typescript:S7764 — tests/contentScript.test.ts, tests/popup.test.tsx, src/pages/Content/script.ts: Replaced `window` usage with `globalThis` so code and tests run in any JS runtime.
- javascript:S2486 — utils/checkLicenses.mjs:107 & utils/generateLicenseTable.mjs:92: Logged parsing failures instead of silently dropping the caught errors.
- typescript:S7732 — src/hooks.ts:41: Switched `instanceof Function` checks to `typeof` while preserving type safety.
- typescript:S7737 — src/iCloudClient.ts:69: Destructured the sign-out options parameter with defaults and handled the request failure explicitly.
- typescript:S7735 — src/iCloudClient.ts:27: Returned on successful responses before throwing for failures to avoid negated conditions.
- typescript:S7728 — src/pages/Content/script.ts:126 & 142: Replaced `classList.forEach` usage with an explicit helper to strip cursor classes.

## Remaining Issues

- None.

## Info Issues

### typescript:S1135 — src/pages/Popup/Popup.tsx:250
- Line 250: Complete the task associated to this `TODO` comment.
#### Suggested Resolution
- Resolve the outstanding TODO or convert it into a tracked work item so the code no longer carries the placeholder.

### typescript:S1135 — src/storage.ts:16
- Line 16: Complete the task associated to this `TODO` comment.
#### Suggested Resolution
- Address the noted TODO or link it to a backlog item, then remove the in-code reminder.
