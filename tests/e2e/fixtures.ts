import { test as base, chromium, type BrowserContext } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, runTestWithContext) => {
    // Deliberately not build/chrome-mv3: these tests drive the UI through demo
    // mode, which is compiled out of release builds. `--mode e2e` gives its own
    // output directory, so a release build can never be picked up by accident.
    const pathToExtension = path.resolve(
      __dirname,
      '../../build/chrome-mv3-e2e'
    );
    if (!fs.existsSync(pathToExtension)) {
      throw new Error(
        `Demo-mode build not found at ${pathToExtension}. Run 'npm run build:e2e' first.`
      );
    }
    const userDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'hme-extension-e2e-')
    );
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await runTestWithContext(context);
    await context.close();
    if (fs.existsSync(userDataDir)) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  },
  extensionId: async ({ context }, runTestWithExtensionId) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }

    // Extract ID from worker URL: chrome-extension://<id>/background.js
    const extensionId = background.url().split('/')[2];
    await runTestWithExtensionId(extensionId);
  },
});

export { expect } from '@playwright/test';
export type { Page } from '@playwright/test';
