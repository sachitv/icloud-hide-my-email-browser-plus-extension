import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTEXT_MENU_ITEM_ID } from '../src/pages/Background/constants';
import { DEFAULT_SETUP_URL } from '../src/iCloudClient';
import { DEFAULT_STORE } from '../src/storage';

type WebRequestListenerEntry = {
  callback: (details: { statusCode: number; url: string }) => unknown;
  filter: { urls?: string[] };
};

type RuntimeDetails = {
  reason: string;
};

const {
  webRequestListeners,
  webRequestAddListenerMock,
  contextMenusUpdateMock,
  notificationsCreateMock,
  storageLocalGetMock,
  storageLocalSetMock,
  storageLocalRemoveMock,
  runtimeGetUrlMock,
  tabsQueryMock,
  contextMenusCreateMock,
  contextMenusOnClickedAddListenerMock,
  storageOnChangedAddListenerMock,
  runtimeOnMessageAddListenerMock,
  runtimeOnInstalledAddListenerMock,
  runtimeOnInstalledListeners,
  isAuthenticatedMock,
  PremiumMailSettingsMock,
  sendMessageToTabMock,
  chromeTabsCreateMock,
} = vi.hoisted(() => {
  const webRequestListeners: WebRequestListenerEntry[] = [];
  const webRequestAddListenerMock = vi.fn(
    (
      listener: WebRequestListenerEntry['callback'],
      filter: WebRequestListenerEntry['filter']
    ) => {
      webRequestListeners.push({ callback: listener, filter });
    }
  );
  const contextMenusUpdateMock = vi.fn().mockResolvedValue(undefined);
  const notificationsCreateMock = vi.fn().mockResolvedValue('notification-id');
  const storageLocalGetMock = vi.fn();
  storageLocalGetMock.mockResolvedValue({});
  const storageLocalSetMock = vi.fn().mockResolvedValue(undefined);
  const storageLocalRemoveMock = vi.fn().mockResolvedValue(undefined);
  const runtimeGetUrlMock = vi.fn();
  runtimeGetUrlMock.mockReturnValue('chrome-extension://test-extension/');
  const tabsQueryMock = vi.fn().mockResolvedValue([]);
  const contextMenusCreateMock = vi.fn();
  const contextMenusOnClickedAddListenerMock = vi.fn();
  const storageOnChangedAddListenerMock = vi.fn();
  const runtimeOnMessageAddListenerMock = vi.fn();
  const runtimeOnInstalledListeners: Array<(details: RuntimeDetails) => void> = [];
  const runtimeOnInstalledAddListenerMock = vi.fn(
    (listener: (details: RuntimeDetails) => void) => {
      runtimeOnInstalledListeners.push(listener);
    }
  );
  const isAuthenticatedMock = vi.fn();
  const PremiumMailSettingsMock = vi.fn(() => ({
    generateHme: vi.fn(),
    reserveHme: vi.fn(),
  }));
  const sendMessageToTabMock = vi.fn().mockResolvedValue(undefined);
  const chromeTabsCreateMock = vi.fn().mockResolvedValue(undefined);

  return {
    webRequestListeners,
    webRequestAddListenerMock,
    contextMenusUpdateMock,
    notificationsCreateMock,
    storageLocalGetMock,
    storageLocalSetMock,
    storageLocalRemoveMock,
    runtimeGetUrlMock,
    tabsQueryMock,
    contextMenusCreateMock,
    contextMenusOnClickedAddListenerMock,
    storageOnChangedAddListenerMock,
    runtimeOnMessageAddListenerMock,
    runtimeOnInstalledAddListenerMock,
    runtimeOnInstalledListeners,
    isAuthenticatedMock,
    PremiumMailSettingsMock,
    sendMessageToTabMock,
    chromeTabsCreateMock,
  };
});

vi.mock('webextension-polyfill', () => ({
  default: {
    webRequest: {
      onResponseStarted: {
        addListener: webRequestAddListenerMock,
      },
    },
    contextMenus: {
      update: contextMenusUpdateMock,
      create: contextMenusCreateMock,
      onClicked: { addListener: contextMenusOnClickedAddListenerMock },
    },
    notifications: {
      create: notificationsCreateMock,
    },
    storage: {
      local: {
        get: storageLocalGetMock,
        set: storageLocalSetMock,
        remove: storageLocalRemoveMock,
      },
      onChanged: { addListener: storageOnChangedAddListenerMock },
    },
    runtime: {
      onMessage: { addListener: runtimeOnMessageAddListenerMock },
      onInstalled: { addListener: runtimeOnInstalledAddListenerMock },
      getURL: runtimeGetUrlMock,
      id: 'test-extension',
    },
    tabs: {
      query: tabsQueryMock,
    },
  },
}));

vi.mock('../src/iCloudClient', async () => {
  const actual = await vi.importActual<typeof import('../src/iCloudClient')>(
    '../src/iCloudClient'
  );

  class ICloudClientMock {
    public webservices?: Record<string, { url: string; status: string }>;

    constructor(
      readonly setupUrl: typeof actual.DEFAULT_SETUP_URL,
      webservices?: Record<string, { url: string; status: string }>
    ) {
      this.webservices = webservices;
    }

    isAuthenticated(...args: unknown[]) {
      return isAuthenticatedMock(...(args as []));
    }
  }

  return {
    ...actual,
    default: ICloudClientMock,
    PremiumMailSettings: PremiumMailSettingsMock,
  };
});

vi.mock('../src/messages', async () => {
  const actual = await vi.importActual<typeof import('../src/messages')>(
    '../src/messages'
  );

  return {
    ...actual,
    sendMessageToTab: sendMessageToTabMock,
  };
});

describe('background webRequest listeners', () => {
  const importBackground = () => import('../src/pages/Background');

  const getListener = (matcher: (filter: WebRequestListenerEntry['filter']) => boolean) => {
    const entry = webRequestListeners.find(({ filter }) => matcher(filter));
    if (!entry) {
      throw new Error('Expected webRequest listener to be registered');
    }
    return entry.callback;
  };

  beforeEach(async () => {
    vi.resetModules();
    webRequestListeners.length = 0;
    webRequestAddListenerMock.mockClear();
    contextMenusUpdateMock.mockClear();
    notificationsCreateMock.mockClear();
    storageLocalGetMock.mockReset();
    storageLocalSetMock.mockClear();
    storageLocalRemoveMock.mockClear();
    runtimeGetUrlMock.mockClear();
    runtimeGetUrlMock.mockReturnValue('chrome-extension://test-extension/');
    tabsQueryMock.mockClear();
    contextMenusCreateMock.mockClear();
    contextMenusOnClickedAddListenerMock.mockClear();
    storageOnChangedAddListenerMock.mockClear();
    runtimeOnMessageAddListenerMock.mockClear();
    runtimeOnInstalledAddListenerMock.mockClear();
    runtimeOnInstalledListeners.length = 0;
    isAuthenticatedMock.mockReset();
    PremiumMailSettingsMock.mockClear();
    sendMessageToTabMock.mockClear();
    chromeTabsCreateMock.mockClear();

    storageLocalGetMock.mockImplementation(async (key: string | string[]) => {
      if (typeof key === 'string') {
        return { [key]: undefined };
      }
      return key.reduce<Record<string, unknown>>((acc, current) => {
        acc[current] = undefined;
        return acc;
      }, {});
    });

    (globalThis as unknown as { chrome?: unknown }).chrome = {
      tabs: { create: chromeTabsCreateMock },
    };

    await importBackground();
  });

  it('performs authentication side effects when login succeeds', async () => {
    isAuthenticatedMock.mockResolvedValue(true);

    const loginListener = getListener((filter) =>
      filter.urls?.some((url) => url.includes('/accountLogin')) ?? false
    );

    await loginListener({
      statusCode: 200,
      url: `${DEFAULT_SETUP_URL}/accountLogin?clientBuildNumber=1`,
    });

    expect(isAuthenticatedMock).toHaveBeenCalledTimes(1);
    expect(storageLocalSetMock).toHaveBeenCalledWith({
      clientState: {
        setupUrl: DEFAULT_SETUP_URL,
        webservices: undefined,
      },
    });
    expect(contextMenusUpdateMock).toHaveBeenCalledWith(
      CONTEXT_MENU_ITEM_ID,
      expect.objectContaining({ enabled: true })
    );
    expect(notificationsCreateMock).toHaveBeenCalled();
  });

  it('skips authentication side effects when login fails', async () => {
    const loginListener = getListener((filter) =>
      filter.urls?.some((url) => url.includes('/accountLogin')) ?? false
    );

    await loginListener({
      statusCode: 401,
      url: `${DEFAULT_SETUP_URL}/accountLogin`,
    });

    expect(isAuthenticatedMock).not.toHaveBeenCalled();
    expect(storageLocalSetMock).not.toHaveBeenCalled();
    expect(contextMenusUpdateMock).not.toHaveBeenCalled();
    expect(notificationsCreateMock).not.toHaveBeenCalled();
  });

  it('performs deauthentication side effects when logout succeeds', async () => {
    const logoutListener = getListener((filter) =>
      filter.urls?.some((url) => url.includes('/logout')) ?? false
    );

    await logoutListener({
      statusCode: 204,
      url: `${DEFAULT_SETUP_URL}/logout`,
    });

    expect(storageLocalSetMock).toHaveBeenCalledWith({
      popupState: DEFAULT_STORE.popupState,
    });
    expect(storageLocalRemoveMock).toHaveBeenCalledWith('clientState');
    expect(contextMenusUpdateMock).toHaveBeenCalledWith(
      CONTEXT_MENU_ITEM_ID,
      expect.objectContaining({ enabled: false })
    );
  });

  it('skips deauthentication side effects when logout fails', async () => {
    const logoutListener = getListener((filter) =>
      filter.urls?.some((url) => url.includes('/logout')) ?? false
    );

    await logoutListener({
      statusCode: 500,
      url: `${DEFAULT_SETUP_URL}/logout`,
    });

    expect(storageLocalSetMock).not.toHaveBeenCalled();
    expect(storageLocalRemoveMock).not.toHaveBeenCalled();
    expect(contextMenusUpdateMock).not.toHaveBeenCalled();
  });

  afterEach(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
  });
});
