import browser from 'webextension-polyfill';
import {
  constructClient,
  performAuthSideEffects,
  performDeauthSideEffects,
} from './authSync';

export const setupLifecycle = () => {
  // Sync the extension with the authentication state of the browser.
  // If the user is already authenticated, they should not need to
  // log out and log back in in order to get the extension working.
  browser.runtime.onInstalled.addListener(
    async (details: browser.Runtime.OnInstalledDetailsType) => {
      if (['install', 'update'].includes(details.reason)) {
        const client = await constructClient();
        const isAuthenticated = await client.isAuthenticated();
        if (isAuthenticated) {
          await performAuthSideEffects(client, { notification: true });
        } else {
          await performDeauthSideEffects();
        }
      }
    }
  );

  // Present the user with a getting-started guide.
  browser.runtime.onInstalled.addListener(
    async (details: browser.Runtime.OnInstalledDetailsType) => {
      const userguideUrl = browser.runtime.getURL('userguide.html');

      if (details.reason === 'install') {
        browser.tabs.create({ url: userguideUrl }).catch(console.debug);
      }
    }
  );
};
