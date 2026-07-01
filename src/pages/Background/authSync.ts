import browser from 'webextension-polyfill';
import {
  getBrowserStorageValue,
  setBrowserStorageValue,
  DEFAULT_STORE,
} from '../../storage';
import ICloudClient, {
  DEFAULT_SETUP_URL,
  CN_SETUP_URL,
} from '../../iCloudClient';
import {
  CONTEXT_MENU_ITEM_ID,
  NOTIFICATION_MESSAGE_COPY,
  NOTIFICATION_TITLE_COPY,
  SIGNED_IN_CTA_COPY,
  SIGNED_OUT_CTA_COPY,
} from '../../constants';

export const constructClient = async (): Promise<ICloudClient> => {
  const clientState = await getBrowserStorageValue('clientState');

  if (clientState === undefined) {
    console.debug('constructClient: Using default setupUrl');
    return new ICloudClient(DEFAULT_SETUP_URL);
  }

  return new ICloudClient(clientState.setupUrl, clientState.webservices);
};

export const performDeauthSideEffects = async () => {
  await Promise.all([
    setBrowserStorageValue('popupState', DEFAULT_STORE.popupState),
    setBrowserStorageValue('clientState', DEFAULT_STORE.clientState),
    setBrowserStorageValue('cachedHmeList', DEFAULT_STORE.cachedHmeList),
  ]);

  await browser.contextMenus
    .update(CONTEXT_MENU_ITEM_ID, {
      title: SIGNED_OUT_CTA_COPY,
      enabled: false,
    })
    .catch(console.debug);
};

export const performAuthSideEffects = async (
  client: ICloudClient,
  options: { notification?: boolean } = {}
) => {
  const { notification = false } = options;

  await setBrowserStorageValue('clientState', {
    setupUrl: client.setupUrl,
    webservices: client.webservices,
  });

  browser.contextMenus
    .update(CONTEXT_MENU_ITEM_ID, {
      title: SIGNED_IN_CTA_COPY,
      enabled: true,
    })
    .catch(console.debug);

  if (notification) {
    browser.notifications
      .create({
        type: 'basic',
        title: NOTIFICATION_TITLE_COPY,
        message: NOTIFICATION_MESSAGE_COPY,
        iconUrl: 'icon-128.png',
      })
      .catch(console.debug);
  }
};

export const setupAuthSync = () => {
  // The extension needs to be in sync with the icloud.com authentication state of the browser.
  // For example, when the user is authenticated we need to render the context menu item
  // as enabled.
  browser.webRequest.onResponseStarted.addListener(
    async (details: browser.WebRequest.OnResponseStartedDetailsType) => {
      const { statusCode, url } = details;
      if (statusCode < 200 || statusCode > 299) {
        console.debug('Request failed', details);
        return;
      }

      const setupUrl = url.split(
        '/accountLogin'
      )[0] as ICloudClient['setupUrl'];
      const client = new ICloudClient(setupUrl);
      const isAuthenticated = await client.isAuthenticated();
      if (isAuthenticated) {
        await performAuthSideEffects(client, { notification: true });
      }
    },
    {
      urls: [
        `${DEFAULT_SETUP_URL}/accountLogin*`,
        `${CN_SETUP_URL}/accountLogin*`,
      ],
    },
    []
  );

  // When the user signs out of their account through icloud.com, we should
  // perform various side effects (e.g. disabling the context menu item)
  browser.webRequest.onResponseStarted.addListener(
    async (details: browser.WebRequest.OnResponseStartedDetailsType) => {
      const { statusCode } = details;
      if (statusCode < 200 || statusCode > 299) {
        console.debug('Request failed', details);
        return;
      }

      await performDeauthSideEffects();
    },
    {
      urls: [`${DEFAULT_SETUP_URL}/logout*`, `${CN_SETUP_URL}/logout*`],
    },
    []
  );
};
