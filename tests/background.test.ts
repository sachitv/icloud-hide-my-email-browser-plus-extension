import { beforeEach, describe, expect, it, vi } from 'vitest';
import browser from 'webextension-polyfill';
import {
  setupAuthSync,
  constructClient,
  performAuthSideEffects,
  performDeauthSideEffects,
} from '../src/pages/Background/authSync';
import {
  setupContextMenuListeners,
  setupContextMenu,
} from '../src/pages/Background/contextMenu';
import { setupMessageHandlers } from '../src/pages/Background/messageHandlers';
import { setupLifecycle } from '../src/pages/Background/lifecycle';
import { MessageType } from '../src/messages';
import ICloudClient from '../src/iCloudClient';

const { browserMocks, listeners, mockICloudClientClasses } = vi.hoisted(() => {
  const mockIsAuthenticated = vi.fn().mockResolvedValue(true);
  const mockGenerateHme = vi.fn().mockResolvedValue('test-hme@icloud.com');
  const mockReserveHme = vi.fn().mockResolvedValue(undefined);

  class MockICloudClient {
    setupUrl: string;
    webservices: Record<string, unknown>;
    constructor(setupUrl?: string, webservices?: Record<string, unknown>) {
      this.setupUrl = setupUrl || 'https://setup.example.com';
      this.webservices = webservices || {};
    }
    isAuthenticated = mockIsAuthenticated;
  }

  class MockPremiumMailSettings {
    client: MockICloudClient;
    constructor(client: MockICloudClient) {
      this.client = client;
    }
    generateHme = mockGenerateHme;
    reserveHme = mockReserveHme;
  }

  const listeners = {
    webRequest: [] as Array<
      (
        details: browser.WebRequest.OnResponseStartedDetailsType
      ) => Promise<void>
    >,
    runtimeInstalled: [] as Array<
      (details: browser.Runtime.OnInstalledDetailsType) => Promise<void>
    >,
    storageChanged: [] as Array<
      (
        changes: Record<string, browser.Storage.StorageChange>,
        namespace: string
      ) => void
    >,
    contextMenusClicked: [] as Array<
      (info: browser.Menus.OnClickData, tab?: browser.Tabs.Tab) => Promise<void>
    >,
    commandsCommand: [] as Array<(command: string) => Promise<void>>,
    runtimeMessage: [] as Array<
      (
        message: unknown,
        sender: browser.Runtime.MessageSender,
        sendResponse: (response?: unknown) => void
      ) => unknown
    >,
  };

  const browserMocks = {
    webRequest: {
      onResponseStarted: {
        addListener: vi.fn((cb) => {
          listeners.webRequest.push(cb);
        }),
      },
    },
    runtime: {
      id: 'extension-id',
      onInstalled: {
        addListener: vi.fn((cb) => {
          listeners.runtimeInstalled.push(cb);
        }),
      },
      onMessage: {
        addListener: vi.fn((cb) => {
          listeners.runtimeMessage.push(cb);
        }),
      },
      getURL: vi.fn(() => 'userguide.html'),
    },
    storage: {
      onChanged: {
        addListener: vi.fn((cb) => {
          listeners.storageChanged.push(cb);
        }),
      },
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
      },
    },
    contextMenus: {
      create: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      onClicked: {
        addListener: vi.fn((cb) => {
          listeners.contextMenusClicked.push(cb);
        }),
      },
    },
    commands: {
      onCommand: {
        addListener: vi.fn((cb) => {
          listeners.commandsCommand.push(cb);
        }),
      },
    },
    action: {
      openPopup: vi.fn().mockResolvedValue(undefined),
    },
    tabs: {
      query: vi.fn(),
      sendMessage: vi.fn(),
      create: vi.fn().mockResolvedValue(undefined),
    },
    notifications: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  };

  return {
    browserMocks,
    listeners,
    mockICloudClientClasses: {
      MockICloudClient,
      MockPremiumMailSettings,
      mockIsAuthenticated,
      mockGenerateHme,
      mockReserveHme,
    },
  };
});

vi.mock('webextension-polyfill', () => ({
  __esModule: true,
  default: browserMocks,
}));

// Mock iCloudClient and PremiumMailSettings
const { mockIsAuthenticated, mockGenerateHme, mockReserveHme } =
  mockICloudClientClasses;

vi.mock('../src/iCloudClient', () => {
  return {
    default: mockICloudClientClasses.MockICloudClient,
    PremiumMailSettings: mockICloudClientClasses.MockPremiumMailSettings,
    DEFAULT_SETUP_URL: 'https://setup.example.com',
    CN_SETUP_URL: 'https://setup.example.cn',
  };
});

// Mock browserUtils
vi.mock('../src/browserUtils', () => ({
  isFirefox: false,
}));

globalThis.chrome = {
  tabs: {
    create: vi.fn().mockResolvedValue(undefined),
  },
} as unknown as typeof chrome;

describe('Background Script Refactored Modules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listeners.webRequest = [];
    listeners.runtimeInstalled = [];
    listeners.storageChanged = [];
    listeners.contextMenusClicked = [];
    listeners.commandsCommand = [];
    listeners.runtimeMessage = [];

    mockIsAuthenticated.mockResolvedValue(true);
    mockGenerateHme.mockResolvedValue('test-hme@icloud.com');
    mockReserveHme.mockResolvedValue(undefined);
  });

  describe('authSync module', () => {
    it('constructs default client when clientState is missing', async () => {
      browserMocks.storage.local.get.mockResolvedValue({});
      const client = await constructClient();
      expect(client.setupUrl).toBe('https://setup.example.com');
    });

    it('performs deauthentication side effects', async () => {
      await performDeauthSideEffects();
      expect(browserMocks.storage.local.set).toHaveBeenCalled();
      expect(browserMocks.contextMenus.update).toHaveBeenCalled();
    });

    it('performs authentication side effects', async () => {
      const clientMock = {
        setupUrl: 'https://setup.example.com',
        webservices: {},
      } as unknown as ICloudClient;
      await performAuthSideEffects(clientMock, { notification: true });
      expect(browserMocks.storage.local.set).toHaveBeenCalled();
      expect(browserMocks.contextMenus.update).toHaveBeenCalled();
      expect(browserMocks.notifications.create).toHaveBeenCalled();
    });

    it('sets up webRequest sync listeners', () => {
      setupAuthSync();
      expect(
        browserMocks.webRequest.onResponseStarted.addListener
      ).toHaveBeenCalledTimes(2);
    });
  });

  describe('contextMenu module', () => {
    it('sets up contextMenu options and listeners', async () => {
      browserMocks.storage.local.get.mockResolvedValue({
        iCloudHmeOptions: { autofill: { contextMenu: true } },
      });
      await setupContextMenu();
      expect(browserMocks.contextMenus.create).toHaveBeenCalled();
    });

    it('triggers generateAndAutofill when context menu is clicked', async () => {
      setupContextMenuListeners();
      const clickListener = listeners.contextMenusClicked[0];
      expect(clickListener).toBeDefined();

      browserMocks.storage.local.get.mockResolvedValue({
        clientState: { setupUrl: 'https://setup.example.com', webservices: {} },
      });

      const tab = {
        id: 1,
        url: 'https://example.com/login',
      } as unknown as browser.Tabs.Tab;
      await clickListener(
        {
          menuItemId: 'extension-id/hme_generation_and_reservation',
          pageUrl: 'https://example.com/login',
        },
        tab
      );

      expect(browserMocks.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          type: MessageType.ActiveInputElementWrite,
          data: expect.objectContaining({ text: 'test-hme@icloud.com' }),
        })
      );
    });

    it('suggest-alias command generates and autofills if input is focused', async () => {
      setupContextMenuListeners();
      const commandListener = listeners.commandsCommand[0];
      expect(commandListener).toBeDefined();

      // Mock active tab
      browserMocks.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://example.com/login' },
      ]);
      // Mock content script responding true (focused email input)
      browserMocks.tabs.sendMessage.mockResolvedValueOnce(true);

      browserMocks.storage.local.get.mockResolvedValue({
        clientState: { setupUrl: 'https://setup.example.com', webservices: {} },
      });

      await commandListener('suggest-alias');

      expect(browserMocks.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: MessageType.QueryActiveElementFocus,
      });
      // Should trigger generateAndAutofill
      expect(browserMocks.tabs.sendMessage).toHaveBeenLastCalledWith(
        1,
        expect.objectContaining({
          type: MessageType.ActiveInputElementWrite,
          data: expect.objectContaining({ text: 'test-hme@icloud.com' }),
        })
      );
    });

    it('suggest-alias command opens popup if input is not focused', async () => {
      setupContextMenuListeners();
      const commandListener = listeners.commandsCommand[0];
      expect(commandListener).toBeDefined();

      browserMocks.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://example.com/login' },
      ]);
      // Mock content script responding false
      browserMocks.tabs.sendMessage.mockResolvedValueOnce(false);

      await commandListener('suggest-alias');

      expect(browserMocks.action.openPopup).toHaveBeenCalled();
    });

    it('suggest-alias command opens popup if message fails', async () => {
      setupContextMenuListeners();
      const commandListener = listeners.commandsCommand[0];
      expect(commandListener).toBeDefined();

      browserMocks.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://example.com/login' },
      ]);
      // Mock message throwing error
      browserMocks.tabs.sendMessage.mockRejectedValueOnce(
        new Error('Connection error')
      );

      await commandListener('suggest-alias');

      expect(browserMocks.action.openPopup).toHaveBeenCalled();
    });
  });

  describe('messageHandlers module', () => {
    it('sets up message listeners and handles GenerateRequest', async () => {
      setupMessageHandlers();
      const messageListener = listeners.runtimeMessage[0];
      expect(messageListener).toBeDefined();

      browserMocks.storage.local.get.mockResolvedValue({
        clientState: { setupUrl: 'https://setup.example.com', webservices: {} },
      });

      // Trigger GenerateRequest
      await messageListener(
        {
          type: MessageType.GenerateRequest,
          data: 'element-id',
        },
        {} as browser.Runtime.MessageSender,
        () => {}
      );

      // Should send message back to active tab
      expect(browserMocks.tabs.sendMessage).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          type: MessageType.GenerateResponse,
          data: expect.objectContaining({
            hme: 'test-hme@icloud.com',
            elementId: 'element-id',
          }),
        })
      );
    });

    it('handles ReservationRequest when clientState is authenticated', async () => {
      setupMessageHandlers();
      const messageListener = listeners.runtimeMessage[0];
      expect(messageListener).toBeDefined();

      browserMocks.storage.local.get.mockResolvedValue({
        clientState: { setupUrl: 'https://setup.example.com', webservices: {} },
      });

      await messageListener(
        {
          type: MessageType.ReservationRequest,
          data: {
            hme: 'test-hme@icloud.com',
            label: 'example.com',
            elementId: 'element-id',
          },
        },
        {} as browser.Runtime.MessageSender,
        () => {}
      );

      expect(mockReserveHme).toHaveBeenCalledWith(
        'test-hme@icloud.com',
        'example.com'
      );
      expect(browserMocks.tabs.sendMessage).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          type: MessageType.ReservationResponse,
          data: expect.objectContaining({
            hme: 'test-hme@icloud.com',
            elementId: 'element-id',
          }),
        })
      );
    });

    it('sends deauth response when clientState is missing for ReservationRequest', async () => {
      setupMessageHandlers();
      const messageListener = listeners.runtimeMessage[0];
      browserMocks.storage.local.get.mockResolvedValue({});
      browserMocks.tabs.query.mockResolvedValue([{ id: 99 }]);

      await messageListener(
        {
          type: MessageType.ReservationRequest,
          data: {
            hme: 'test-hme@icloud.com',
            label: 'example.com',
            elementId: 'element-id',
          },
        },
        {} as browser.Runtime.MessageSender,
        () => {}
      );

      expect(mockReserveHme).not.toHaveBeenCalled();
      expect(browserMocks.tabs.sendMessage).toHaveBeenCalledWith(
        99,
        expect.objectContaining({
          type: MessageType.ReservationResponse,
          data: expect.objectContaining({ error: expect.any(String) }),
        })
      );
      expect(browserMocks.storage.local.set).toHaveBeenCalled();
    });

    it('sends deauth response when clientState is unauthenticated for ReservationRequest', async () => {
      setupMessageHandlers();
      const messageListener = listeners.runtimeMessage[0];
      browserMocks.storage.local.get.mockResolvedValue({
        clientState: { setupUrl: 'https://setup.example.com', webservices: {} },
      });
      browserMocks.tabs.query.mockResolvedValue([{ id: 99 }]);
      mockIsAuthenticated.mockResolvedValue(false);

      await messageListener(
        {
          type: MessageType.ReservationRequest,
          data: {
            hme: 'test-hme@icloud.com',
            label: 'example.com',
            elementId: 'element-id',
          },
        },
        {} as browser.Runtime.MessageSender,
        () => {}
      );

      expect(mockReserveHme).not.toHaveBeenCalled();
      expect(browserMocks.tabs.sendMessage).toHaveBeenCalledWith(
        99,
        expect.objectContaining({
          type: MessageType.ReservationResponse,
          data: expect.objectContaining({ error: expect.any(String) }),
        })
      );
      expect(browserMocks.storage.local.set).toHaveBeenCalled();
    });
  });

  describe('lifecycle module', () => {
    it('sets up post-installed listeners', () => {
      setupLifecycle();
      expect(
        browserMocks.runtime.onInstalled.addListener
      ).toHaveBeenCalledTimes(2);
    });

    it('shows getting started guide on install', async () => {
      setupLifecycle();
      const installListener = listeners.runtimeInstalled[1];
      expect(installListener).toBeDefined();

      await installListener({
        reason: 'install',
      } as browser.Runtime.OnInstalledDetailsType);
      expect(browserMocks.tabs.create).toHaveBeenCalledWith({
        url: 'userguide.html',
      });
    });

    it('does not open guide for browser_update reason', async () => {
      setupLifecycle();
      const guideListener = listeners.runtimeInstalled[1];
      await guideListener({
        reason: 'browser_update',
      } as browser.Runtime.OnInstalledDetailsType);
      expect(browserMocks.tabs.create).not.toHaveBeenCalled();
    });

    it('performs auth side effects on install when client is authenticated', async () => {
      browserMocks.storage.local.get.mockResolvedValue({});
      mockIsAuthenticated.mockResolvedValue(true);
      setupLifecycle();
      const authListener = listeners.runtimeInstalled[0];
      await authListener({
        reason: 'install',
      } as browser.Runtime.OnInstalledDetailsType);
      expect(browserMocks.storage.local.set).toHaveBeenCalled();
    });

    it('performs deauth side effects on install when client is not authenticated', async () => {
      browserMocks.storage.local.get.mockResolvedValue({});
      mockIsAuthenticated.mockResolvedValue(false);
      setupLifecycle();
      const authListener = listeners.runtimeInstalled[0];
      await authListener({
        reason: 'install',
      } as browser.Runtime.OnInstalledDetailsType);
      expect(browserMocks.storage.local.set).toHaveBeenCalled();
    });

    it('performs auth side effects on update', async () => {
      browserMocks.storage.local.get.mockResolvedValue({});
      mockIsAuthenticated.mockResolvedValue(true);
      setupLifecycle();
      const authListener = listeners.runtimeInstalled[0];
      await authListener({
        reason: 'update',
      } as browser.Runtime.OnInstalledDetailsType);
      expect(browserMocks.storage.local.set).toHaveBeenCalled();
    });

    it('does nothing on browser_update for the auth listener', async () => {
      browserMocks.storage.local.get.mockResolvedValue({});
      setupLifecycle();
      const authListener = listeners.runtimeInstalled[0];
      await authListener({
        reason: 'browser_update',
      } as browser.Runtime.OnInstalledDetailsType);
      expect(browserMocks.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('authSync webRequest listeners', () => {
    it('fires auth side effects when login request succeeds (2xx status)', async () => {
      browserMocks.storage.local.get.mockResolvedValue({});
      mockIsAuthenticated.mockResolvedValue(true);
      setupAuthSync();
      const loginListener = listeners.webRequest[0];
      await loginListener({
        statusCode: 200,
        url: 'https://setup.icloud.com/accountLogin',
      } as unknown as browser.WebRequest.OnResponseStartedDetailsType);
      expect(browserMocks.storage.local.set).toHaveBeenCalled();
    });

    it('skips auth when login request has non-2xx status', async () => {
      setupAuthSync();
      const loginListener = listeners.webRequest[0];
      await loginListener({
        statusCode: 404,
        url: 'https://setup.icloud.com/accountLogin',
      } as unknown as browser.WebRequest.OnResponseStartedDetailsType);
      expect(browserMocks.storage.local.set).not.toHaveBeenCalled();
    });

    it('does not call auth effects when client is not authenticated after login request', async () => {
      browserMocks.storage.local.get.mockResolvedValue({});
      mockIsAuthenticated.mockResolvedValue(false);
      setupAuthSync();
      const loginListener = listeners.webRequest[0];
      await loginListener({
        statusCode: 200,
        url: 'https://setup.icloud.com/accountLogin',
      } as unknown as browser.WebRequest.OnResponseStartedDetailsType);
      expect(browserMocks.storage.local.set).not.toHaveBeenCalled();
    });

    it('fires deauth side effects when logout request succeeds (2xx status)', async () => {
      setupAuthSync();
      const logoutListener = listeners.webRequest[1];
      await logoutListener({
        statusCode: 200,
      } as unknown as browser.WebRequest.OnResponseStartedDetailsType);
      expect(browserMocks.storage.local.set).toHaveBeenCalled();
    });

    it('skips deauth when logout request has non-2xx status', async () => {
      setupAuthSync();
      const logoutListener = listeners.webRequest[1];
      await logoutListener({
        statusCode: 503,
      } as unknown as browser.WebRequest.OnResponseStartedDetailsType);
      expect(browserMocks.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('contextMenu — additional branches', () => {
    it('setupContextMenu callback calls performAuthSideEffects when authenticated', async () => {
      browserMocks.storage.local.get.mockResolvedValue({
        iCloudHmeOptions: { autofill: { contextMenu: true } },
      });
      mockIsAuthenticated.mockResolvedValue(true);
      await setupContextMenu();
      const createCallback = browserMocks.contextMenus.create.mock
        .calls[0][1] as () => Promise<void>;
      browserMocks.storage.local.get.mockResolvedValue({});
      await createCallback();
      expect(browserMocks.storage.local.set).toHaveBeenCalled();
    });

    it('setupContextMenu callback calls performDeauthSideEffects when not authenticated', async () => {
      browserMocks.storage.local.get.mockResolvedValue({
        iCloudHmeOptions: { autofill: { contextMenu: true } },
      });
      mockIsAuthenticated.mockResolvedValue(false);
      await setupContextMenu();
      const createCallback = browserMocks.contextMenus.create.mock
        .calls[0][1] as () => Promise<void>;
      browserMocks.storage.local.get.mockResolvedValue({});
      await createCallback();
      expect(browserMocks.storage.local.set).toHaveBeenCalled();
    });

    it('setupContextMenu falls back to DEFAULT_STORE options when none stored', async () => {
      browserMocks.storage.local.get.mockResolvedValue({
        iCloudHmeOptions: null,
      });
      await setupContextMenu();
      expect(browserMocks.contextMenus.create).toHaveBeenCalled();
    });

    it('ignores context menu click with wrong menuItemId', async () => {
      setupContextMenuListeners();
      const clickListener = listeners.contextMenusClicked[0];
      await clickListener({ menuItemId: 'other-id', pageUrl: 'https://x.com' });
      expect(browserMocks.tabs.sendMessage).not.toHaveBeenCalled();
    });

    it('suggest-alias command opens popup when no active tab is found', async () => {
      setupContextMenuListeners();
      const commandListener = listeners.commandsCommand[0];
      browserMocks.tabs.query.mockResolvedValue([]);
      await commandListener('suggest-alias');
      expect(browserMocks.action.openPopup).toHaveBeenCalled();
    });

    it('suggest-alias command opens popup when active tab has no id', async () => {
      setupContextMenuListeners();
      const commandListener = listeners.commandsCommand[0];
      browserMocks.tabs.query.mockResolvedValue([{ url: 'https://x.com' }]);
      await commandListener('suggest-alias');
      expect(browserMocks.action.openPopup).toHaveBeenCalled();
    });

    it('ignores non-suggest-alias commands', async () => {
      setupContextMenuListeners();
      const commandListener = listeners.commandsCommand[0];
      await commandListener('some-other-command');
      expect(browserMocks.action.openPopup).not.toHaveBeenCalled();
    });

    it('generateAndAutofill sends signed-out text when client is not authenticated', async () => {
      setupContextMenuListeners();
      const clickListener = listeners.contextMenusClicked[0];
      browserMocks.storage.local.get.mockResolvedValue({
        clientState: { setupUrl: 'https://setup.example.com', webservices: {} },
      });
      mockIsAuthenticated.mockResolvedValue(false);
      const tab = {
        id: 1,
        url: 'https://example.com',
      } as unknown as browser.Tabs.Tab;
      await clickListener(
        {
          menuItemId: 'extension-id/hme_generation_and_reservation',
          pageUrl: 'https://example.com',
        },
        tab
      );
      expect(browserMocks.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          type: MessageType.ActiveInputElementWrite,
          data: expect.objectContaining({ copyToClipboard: false }),
        })
      );
    });

    it('updates context menu visibility when contextMenu option changes', () => {
      setupContextMenuListeners();
      const storageListener = listeners.storageChanged[0];
      storageListener(
        {
          iCloudHmeOptions: {
            oldValue: { autofill: { contextMenu: false } },
            newValue: { autofill: { contextMenu: true } },
          },
        },
        'local'
      );
      expect(browserMocks.contextMenus.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ visible: true })
      );
    });

    it('suggest-alias outer catch fires when tabs.query rejects', async () => {
      setupContextMenuListeners();
      const commandListener = listeners.commandsCommand[0];
      browserMocks.tabs.query.mockRejectedValueOnce(
        new Error('permission denied')
      );
      // Should complete without throwing (error is caught internally)
      await expect(commandListener('suggest-alias')).resolves.not.toThrow();
    });

    it('generateAndAutofill sends error text when generate+reserve throws', async () => {
      setupContextMenuListeners();
      const clickListener = listeners.contextMenusClicked[0];
      browserMocks.storage.local.get.mockResolvedValue({
        clientState: { setupUrl: 'https://setup.example.com', webservices: {} },
      });
      mockGenerateHme.mockRejectedValueOnce(new Error('quota exceeded'));
      const tab = {
        id: 1,
        url: 'https://example.com',
      } as unknown as browser.Tabs.Tab;
      await clickListener(
        {
          menuItemId: 'extension-id/hme_generation_and_reservation',
          pageUrl: 'https://example.com',
        },
        tab
      );
      expect(browserMocks.tabs.sendMessage).toHaveBeenLastCalledWith(
        1,
        expect.objectContaining({
          type: MessageType.ActiveInputElementWrite,
          data: expect.objectContaining({ text: 'quota exceeded' }),
        })
      );
    });

    it('storage change does nothing when contextMenu visibility has not changed', () => {
      setupContextMenuListeners();
      const storageListener = listeners.storageChanged[0];
      storageListener(
        {
          iCloudHmeOptions: {
            oldValue: { autofill: { contextMenu: true } },
            newValue: { autofill: { contextMenu: true } },
          },
        },
        'local'
      );
      expect(browserMocks.contextMenus.update).not.toHaveBeenCalled();
    });

    it('storage change does nothing for non-local namespace', () => {
      setupContextMenuListeners();
      const storageListener = listeners.storageChanged[0];
      storageListener(
        {
          iCloudHmeOptions: {
            oldValue: { autofill: { contextMenu: false } },
            newValue: { autofill: { contextMenu: true } },
          },
        },
        'sync'
      );
      expect(browserMocks.contextMenus.update).not.toHaveBeenCalled();
    });

    it('storage change does nothing when iCloudHmeOptions key is absent', () => {
      setupContextMenuListeners();
      const storageListener = listeners.storageChanged[0];
      storageListener({}, 'local');
      expect(browserMocks.contextMenus.update).not.toHaveBeenCalled();
    });

    it('generateAndAutofill returns early when tab is undefined', async () => {
      setupContextMenuListeners();
      const clickListener = listeners.contextMenusClicked[0];
      // Fire onClicked with a matching menuItemId but no tab (tab = undefined)
      await clickListener(
        {
          menuItemId: 'extension-id/hme_generation_and_reservation',
          pageUrl: 'https://example.com',
        },
        undefined
      );
      // sendMessage should never be called because tab is undefined (early return at line 62)
      expect(browserMocks.tabs.sendMessage).not.toHaveBeenCalled();
    });

    it('generateAndAutofill uses empty hostname when tab has no URL and pageUrl is absent', async () => {
      setupContextMenuListeners();
      const clickListener = listeners.contextMenusClicked[0];
      browserMocks.storage.local.get.mockResolvedValue({
        clientState: { setupUrl: 'https://setup.example.com', webservices: {} },
      });
      browserMocks.tabs.query.mockResolvedValue([{ id: 99 }]);
      const tab = { id: 1 } as unknown as browser.Tabs.Tab; // no .url property
      await clickListener(
        { menuItemId: 'extension-id/hme_generation_and_reservation' }, // no pageUrl
        tab
      );
      // reserveHme should be called with empty string hostname (serializedUrl falsy)
      expect(mockReserveHme).toHaveBeenCalledWith(expect.any(String), '');
    });
  });

  describe('messageHandlers — error and edge-case branches', () => {
    it('sends deauth response when clientState is undefined', async () => {
      setupMessageHandlers();
      const messageListener = listeners.runtimeMessage[0];
      browserMocks.storage.local.get.mockResolvedValue({});
      browserMocks.tabs.query.mockResolvedValue([{ id: 99 }]);
      await messageListener(
        { type: MessageType.GenerateRequest, data: 'el-id' },
        {} as browser.Runtime.MessageSender,
        () => {}
      );
      expect(browserMocks.tabs.sendMessage).toHaveBeenCalledWith(
        99,
        expect.objectContaining({
          type: MessageType.GenerateResponse,
          data: expect.objectContaining({ error: expect.any(String) }),
        })
      );
    });

    it('sends deauth response when client is not authenticated', async () => {
      setupMessageHandlers();
      const messageListener = listeners.runtimeMessage[0];
      browserMocks.storage.local.get.mockResolvedValue({
        clientState: { setupUrl: 'https://setup.example.com', webservices: {} },
      });
      browserMocks.tabs.query.mockResolvedValue([{ id: 99 }]);
      mockIsAuthenticated.mockResolvedValue(false);
      await messageListener(
        { type: MessageType.GenerateRequest, data: 'el-id' },
        {} as browser.Runtime.MessageSender,
        () => {}
      );
      expect(browserMocks.tabs.sendMessage).toHaveBeenCalledWith(
        99,
        expect.objectContaining({
          type: MessageType.GenerateResponse,
          data: expect.objectContaining({ error: expect.any(String) }),
        })
      );
    });

    it('sends error response when generateHme throws', async () => {
      setupMessageHandlers();
      const messageListener = listeners.runtimeMessage[0];
      browserMocks.storage.local.get.mockResolvedValue({
        clientState: { setupUrl: 'https://setup.example.com', webservices: {} },
      });
      browserMocks.tabs.query.mockResolvedValue([{ id: 99 }]);
      mockIsAuthenticated.mockResolvedValue(true);
      mockGenerateHme.mockRejectedValueOnce(new Error('generate failed'));
      await messageListener(
        { type: MessageType.GenerateRequest, data: 'el-id' },
        {} as browser.Runtime.MessageSender,
        () => {}
      );
      expect(browserMocks.tabs.sendMessage).toHaveBeenCalledWith(
        99,
        expect.objectContaining({
          type: MessageType.GenerateResponse,
          data: expect.objectContaining({ error: 'generate failed' }),
        })
      );
    });

    it('sends error response when reserveHme throws', async () => {
      setupMessageHandlers();
      const messageListener = listeners.runtimeMessage[0];
      browserMocks.storage.local.get.mockResolvedValue({
        clientState: { setupUrl: 'https://setup.example.com', webservices: {} },
      });
      browserMocks.tabs.query.mockResolvedValue([{ id: 99 }]);
      mockIsAuthenticated.mockResolvedValue(true);
      mockReserveHme.mockRejectedValueOnce(new Error('reserve failed'));
      await messageListener(
        {
          type: MessageType.ReservationRequest,
          data: { hme: 'x@icloud.com', label: 'x.com', elementId: 'el-id' },
        },
        {} as browser.Runtime.MessageSender,
        () => {}
      );
      expect(browserMocks.tabs.sendMessage).toHaveBeenCalledWith(
        99,
        expect.objectContaining({
          type: MessageType.ReservationResponse,
          data: expect.objectContaining({ error: 'reserve failed' }),
        })
      );
    });

    it('ignores unknown message types', async () => {
      setupMessageHandlers();
      const messageListener = listeners.runtimeMessage[0];
      await messageListener(
        { type: 'UNKNOWN_TYPE', data: null },
        {} as browser.Runtime.MessageSender,
        () => {}
      );
      expect(browserMocks.tabs.sendMessage).not.toHaveBeenCalled();
    });
  });
});
