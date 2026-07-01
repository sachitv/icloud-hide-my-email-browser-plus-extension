import browser from 'webextension-polyfill';
import {
  getBrowserStorageValue,
  DEFAULT_STORE,
  Store,
  Options,
} from '../../storage';
import {
  CONTEXT_MENU_ITEM_ID,
  LOADING_COPY,
  SIGNED_OUT_CTA_COPY,
} from '../../constants';
import {
  ActiveInputElementWriteData,
  MessageType,
  sendMessageToTab,
} from '../../messages';
import { formatError } from '../../utils/formatError';
import { PremiumMailSettings } from '../../iCloudClient';
import { isFirefox } from '../../browserUtils';
import {
  constructClient,
  performAuthSideEffects,
  performDeauthSideEffects,
} from './authSync';

type OptionsStorageChange = {
  [K in keyof browser.Storage.StorageChange]: browser.Storage.StorageChange[K] extends unknown
    ? Options
    : browser.Storage.StorageChange[K];
};

export const setupContextMenu = async () => {
  const options =
    (await getBrowserStorageValue('iCloudHmeOptions')) ||
    DEFAULT_STORE.iCloudHmeOptions;

  browser.contextMenus.create(
    {
      id: CONTEXT_MENU_ITEM_ID,
      title: LOADING_COPY,
      contexts: ['editable'],
      enabled: false,
      visible: options.autofill.contextMenu,
    },
    async () => {
      const client = await constructClient();
      const isAuthenticated = await client.isAuthenticated();
      if (isAuthenticated) {
        await performAuthSideEffects(client);
      } else {
        await performDeauthSideEffects();
      }
    }
  );
};

export const generateAndAutofill = async (
  tab: browser.Tabs.Tab | undefined,
  pageUrl?: string
) => {
  if (!tab) return;

  await sendMessageToTab(
    MessageType.ActiveInputElementWrite,
    { text: LOADING_COPY } as ActiveInputElementWriteData,
    tab
  );

  const serializedUrl = pageUrl || tab.url;
  const hostname = serializedUrl ? new URL(serializedUrl).hostname : '';

  const client = await constructClient();
  const isClientAuthenticated = await client.isAuthenticated();

  if (!isClientAuthenticated) {
    await sendMessageToTab(
      MessageType.ActiveInputElementWrite,
      {
        text: SIGNED_OUT_CTA_COPY,
        copyToClipboard: false,
      } as ActiveInputElementWriteData,
      tab
    );
    await performDeauthSideEffects();
    return;
  }

  try {
    const pms = new PremiumMailSettings(client);
    const hme = await pms.generateHme();
    await pms.reserveHme(hme, hostname);
    await sendMessageToTab(
      MessageType.ActiveInputElementWrite,
      { text: hme, copyToClipboard: true } as ActiveInputElementWriteData,
      tab
    );
  } catch (e) {
    await sendMessageToTab(
      MessageType.ActiveInputElementWrite,
      {
        text: formatError(e),
        copyToClipboard: false,
      } as ActiveInputElementWriteData,
      tab
    );
  }
};

const openPopup = async () => {
  if (typeof browser.action?.openPopup !== 'function') {
    return;
  }
  await browser.action.openPopup().catch(console.debug);
};

const handleSuggestAliasCommand = async () => {
  try {
    const [activeTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (activeTab?.id === undefined) {
      await openPopup();
      return;
    }

    const isFocused = await browser.tabs.sendMessage(activeTab.id, {
      type: MessageType.QueryActiveElementFocus,
    });

    if (isFocused === true) {
      await generateAndAutofill(activeTab);
      return;
    }

    await openPopup();
  } catch (e) {
    console.debug('Failed to run suggest-alias command:', e);
    await openPopup();
  }
};

export const setupContextMenuListeners = () => {
  browser.runtime.onInstalled.addListener(setupContextMenu);

  browser.storage.onChanged.addListener((changes, namespace) => {
    const iCloudHmeOptions = changes['iCloudHmeOptions' as keyof Store];
    if (namespace !== 'local' || iCloudHmeOptions === undefined) {
      return;
    }

    const { oldValue, newValue } = iCloudHmeOptions as OptionsStorageChange;

    if (oldValue?.autofill.contextMenu === newValue?.autofill.contextMenu) {
      return;
    }

    browser.contextMenus
      .update(CONTEXT_MENU_ITEM_ID, {
        visible: newValue?.autofill.contextMenu,
      })
      .catch(console.debug);
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ITEM_ID) {
      return;
    }
    await generateAndAutofill(tab, info.pageUrl);
  });

  browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'suggest-alias') {
      return;
    }
    await handleSuggestAliasCommand();
  });

  /* v8 ignore next 3 */
  if (isFirefox) {
    void setupContextMenu();
  }
};
