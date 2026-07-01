import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import Popup from '../src/pages/Popup/Popup';
import { PopupState } from '../src/pages/Popup/stateMachine';
import { createHmeEmailTestData, createClientStateTestData } from './testUtils';
import type { ListHmeResult } from '../src/iCloudClient';

const {
  useBrowserStorageStateMock,
  contextMenuUpdateMock,
  runtimeGetUrlMock,
  tabsQueryMock,
  setBrowserStorageValueMock,
  popupStateSetterMock,
  clientStateSetterMock,
  sendMessageToTabMock,
  isAuthenticatedMock,
  signOutMock,
  listHmeMock,
  generateHmeMock,
  reserveHmeMock,
  updateHmeMetadataMock,
  deactivateHmeMock,
  reactivateHmeMock,
  deleteHmeMock,
  PremiumMailSettingsConstructorMock,
  ICloudClientMock,
  clipboardWriteMock,
  cachedHmeListSetterMock,
} = vi.hoisted(() => {
  const useBrowserStorageStateMock = vi.fn();
  const contextMenuUpdateMock = vi.fn();
  const runtimeGetUrlMock = vi.fn().mockReturnValue('browser:///');
  const tabsQueryMock = vi.fn();
  const setBrowserStorageValueMock = vi.fn();
  const popupStateSetterMock = vi.fn();
  const clientStateSetterMock = vi.fn();
  const sendMessageToTabMock = vi.fn().mockResolvedValue(undefined);

  const isAuthenticatedMock = vi.fn();
  const signOutMock = vi.fn();
  const listHmeMock = vi.fn();
  const generateHmeMock = vi.fn();
  const reserveHmeMock = vi.fn();
  const updateHmeMetadataMock = vi.fn();
  const deactivateHmeMock = vi.fn();
  const reactivateHmeMock = vi.fn();
  const deleteHmeMock = vi.fn();
  const clipboardWriteMock = vi.fn();
  const cachedHmeListSetterMock = vi.fn();

  class ICloudClientMock {
    constructor(
      readonly setupUrl?: string,
      readonly webservices?: Record<string, { url: string; status: string }>
    ) {}

    isAuthenticated = (...args: unknown[]) =>
      isAuthenticatedMock(...(args as []));

    signOut = (...args: unknown[]) => signOutMock(...(args as []));

    webserviceUrl(serviceName: string) {
      return this.webservices?.[serviceName]?.url ?? '';
    }
  }

  const PremiumMailSettingsConstructorMock = vi.fn(function (client: unknown) {
    return {
      client,
      listHme: listHmeMock,
      generateHme: generateHmeMock,
      reserveHme: reserveHmeMock,
      updateHmeMetadata: updateHmeMetadataMock,
      deactivateHme: deactivateHmeMock,
      reactivateHme: reactivateHmeMock,
      deleteHme: deleteHmeMock,
      updateForwardToHme: vi.fn(),
    };
  });

  return {
    useBrowserStorageStateMock,
    contextMenuUpdateMock,
    runtimeGetUrlMock,
    tabsQueryMock,
    setBrowserStorageValueMock,
    popupStateSetterMock,
    clientStateSetterMock,
    sendMessageToTabMock,
    isAuthenticatedMock,
    signOutMock,
    listHmeMock,
    generateHmeMock,
    reserveHmeMock,
    updateHmeMetadataMock,
    deactivateHmeMock,
    reactivateHmeMock,
    deleteHmeMock,
    PremiumMailSettingsConstructorMock,
    ICloudClientMock,
    clipboardWriteMock,
    cachedHmeListSetterMock,
  };
});

vi.mock('../src/hooks', () => ({
  useBrowserStorageState: useBrowserStorageStateMock,
}));

vi.mock('../src/storage', () => ({
  setBrowserStorageValue: setBrowserStorageValueMock,
  DEFAULT_STORE: {
    popupState: 1, // PopupState.SignedOut
    iCloudHmeOptions: { autofill: { button: true, contextMenu: true } },
    clientState: undefined,
    mockMode: false,
  },
}));

vi.mock('../src/mockClient', () => ({
  MockPremiumMailSettings: vi.fn(function MockPMS() {
    return {
      listHme: listHmeMock,
      generateHme: generateHmeMock,
      reserveHme: reserveHmeMock,
      updateHmeMetadata: updateHmeMetadataMock,
      deactivateHme: deactivateHmeMock,
      reactivateHme: reactivateHmeMock,
      deleteHme: deleteHmeMock,
      updateForwardToHme: vi.fn(),
    };
  }),
}));

vi.mock('../src/messages', () => ({
  MessageType: { Autofill: 'Autofill' },
  sendMessageToTab: sendMessageToTabMock,
}));

vi.mock('../src/iCloudClient', () => ({
  default: ICloudClientMock,
  PremiumMailSettings: PremiumMailSettingsConstructorMock,
}));

vi.mock('webextension-polyfill', () => ({
  default: {
    contextMenus: { update: contextMenuUpdateMock },
    runtime: { getURL: runtimeGetUrlMock, id: 'test-extension' },
    tabs: { query: tabsQueryMock },
  },
}));

describe('Milestone 4 Stress Tests & Edge Cases', () => {
  const originalClipboard = globalThis.navigator?.clipboard;

  beforeAll(() => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: {
        writeText: clipboardWriteMock,
      },
    });
  });

  afterAll(() => {
    if (originalClipboard === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (globalThis.navigator as { clipboard?: Clipboard }).clipboard;
    } else {
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  let popupStateValue: PopupState;
  let clientStateValue:
    | {
        setupUrl: string;
        webservices: Record<string, { url: string; status: string }>;
      }
    | undefined;
  let popupStateLoading = false;
  let clientStateLoading = false;
  let cachedHmeListValue: ListHmeResult | undefined = undefined;
  let cachedHmeListLoading = false;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticatedMock.mockReset();
    signOutMock.mockReset();
    listHmeMock.mockReset();
    generateHmeMock.mockReset();
    reserveHmeMock.mockReset();
    PremiumMailSettingsConstructorMock.mockReset();
    useBrowserStorageStateMock.mockReset();
    contextMenuUpdateMock.mockReset();
    runtimeGetUrlMock.mockReset();
    tabsQueryMock.mockReset();
    setBrowserStorageValueMock.mockReset();
    popupStateSetterMock.mockReset();
    clientStateSetterMock.mockReset();
    sendMessageToTabMock.mockReset();
    updateHmeMetadataMock.mockReset();
    deactivateHmeMock.mockReset();
    reactivateHmeMock.mockReset();
    deleteHmeMock.mockReset();
    clipboardWriteMock.mockReset();
    clipboardWriteMock.mockResolvedValue(undefined);

    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();
    popupStateLoading = false;
    clientStateLoading = false;
    cachedHmeListValue = undefined;
    cachedHmeListLoading = false;
    cachedHmeListSetterMock.mockReset();
    cachedHmeListSetterMock.mockImplementation((valOrFn) => {
      if (typeof valOrFn === 'function') {
        cachedHmeListValue = valOrFn(cachedHmeListValue);
      } else {
        cachedHmeListValue = valOrFn;
      }
    });
    user = userEvent.setup();

    runtimeGetUrlMock.mockImplementation(
      (path: string) => `browser:///${path}`
    );

    useBrowserStorageStateMock.mockImplementation((key: string) => {
      if (key === 'popupState') {
        return [popupStateValue, popupStateSetterMock, popupStateLoading];
      }

      if (key === 'clientState') {
        return [clientStateValue, clientStateSetterMock, clientStateLoading];
      }

      if (key === 'mockMode') {
        return [false, vi.fn(), false];
      }

      if (key === 'cachedHmeList') {
        return [
          cachedHmeListValue,
          cachedHmeListSetterMock,
          cachedHmeListLoading,
        ];
      }

      throw new Error(`Unexpected key ${key}`);
    });

    setBrowserStorageValueMock.mockResolvedValue(undefined);
    isAuthenticatedMock.mockResolvedValue(true);
    signOutMock.mockResolvedValue(undefined);
    listHmeMock.mockResolvedValue({
      hmeEmails: [],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });
    generateHmeMock.mockResolvedValue('generated@example.com');
    reserveHmeMock.mockResolvedValue(
      createHmeEmailTestData({
        anonymousId: 'anon',
        note: 'note',
        label: 'label',
        hme: 'generated@example.com',
      })
    );
    contextMenuUpdateMock.mockResolvedValue(undefined);
    tabsQueryMock.mockResolvedValue([{ url: 'https://example.com/path' }]);
    sendMessageToTabMock.mockResolvedValue(undefined);
  });

  // Scenario 1: Empty Lists
  it('handles empty lists gracefully when both cache and fetch return no data', async () => {
    cachedHmeListValue = undefined;
    listHmeMock.mockResolvedValue({
      hmeEmails: [],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    // Loader should show first, then empty list message
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText('There are no emails to list')
      ).toBeInTheDocument();
    });
    expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
  });

  // Scenario 2: Large Lists (1000 items)
  it('renders and manages a large list of 1000 items without throwing errors', async () => {
    const listCount = 1000;
    const largeEmails = Array.from({ length: listCount }, (_, i) =>
      createHmeEmailTestData({
        anonymousId: `anon-${i}`,
        label: `Alias ${i}`,
        hme: `alias${i}@example.com`,
        isActive: i % 2 === 0,
        createTimestamp: Date.now() - i * 60000,
      })
    );

    listHmeMock.mockResolvedValue({
      hmeEmails: largeEmails,
      forwardToEmails: ['forward@example.com'],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    await waitFor(() => {
      expect(screen.getByText('500 active')).toBeInTheDocument();
    });

    // Make sure we can type in search input
    const searchInput = screen.getByPlaceholderText('Search');
    await act(async () => {
      await user.type(searchInput, '999');
    });

    // Should filter to Alias 999
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Alias 999' })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Alias 0' })
      ).not.toBeInTheDocument();
    });
  });

  // Scenario 3: Background fetch failure when offline cache is present (FLAW CONFIRMATION)
  it('shows how a background fetch failure does not overwrite the cached list view with an error screen', async () => {
    // Setup cached value
    cachedHmeListValue = {
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'cached-id',
          label: 'Cached Alias',
          hme: 'cached@example.com',
          isActive: true,
          createTimestamp: Date.now(),
        }),
      ],
      forwardToEmails: ['forward@example.com'],
      selectedForwardTo: 'forward@example.com',
    };

    // Make background fetch reject/throw an error after a brief delay
    let rejectList: (reason: Error) => void = () => {};
    const listHmePromise = new Promise<ListHmeResult>((_, reject) => {
      rejectList = reject;
    });
    listHmeMock.mockReturnValue(listHmePromise);

    render(<Popup />);

    // 1. Cached alias is initially rendered
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Cached Alias' })
      ).toBeInTheDocument();
    });

    // 2. Reject the background fetch
    await act(async () => {
      rejectList(new Error('Network offline or gateway timeout'));
    });

    // 3. Verify that the cached alias remains visible
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Cached Alias' })
      ).toBeInTheDocument();
    });

    // 4. Verify that the full screen error is not rendered
    expect(
      screen.queryByText('Network offline or gateway timeout')
    ).not.toBeInTheDocument();
  });

  // Scenario 4: Special Characters / Non-ASCII Characters
  it('properly renders and searches non-ASCII and special characters in label, note and email', async () => {
    const specialEmails = [
      createHmeEmailTestData({
        anonymousId: 'spec-1',
        label: '标签: 測試中文',
        note: "Détails de l'adresse émail 🌟",
        hme: 'unicode-test@example.com',
      }),
      createHmeEmailTestData({
        anonymousId: 'spec-2',
        label: 'Café & Réservé',
        note: 'Some standard notes',
        hme: 'standard@example.com',
      }),
    ];

    listHmeMock.mockResolvedValue({
      hmeEmails: specialEmails,
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '标签: 測試中文' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Café & Réservé' })
      ).toBeInTheDocument();
    });

    // Test searching non-ASCII characters
    const searchInput = screen.getByPlaceholderText(/search/i);
    await act(async () => {
      await user.type(searchInput, '測試');
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '标签: 測試中文' })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Café & Réservé' })
      ).not.toBeInTheDocument();
    });
  });

  // Scenario 5: CSV values escaping (Commas, Quotes, Excel Formula Injection)
  it('correctly escapes quotes, commas, and checks Excel injection characters in CSV exports', async () => {
    const csvEmails = [
      createHmeEmailTestData({
        anonymousId: 'csv-1',
        label: 'Label with , comma',
        note: 'Note with "quotes" and \n newlines',
        hme: 'csv1@example.com',
        forwardToEmail: 'forward@example.com',
        createTimestamp: 1609459200000, // 2021-01-01T00:00:00.000Z
      }),
      createHmeEmailTestData({
        anonymousId: 'csv-2',
        label: '=SUM(1,2)', // Excel Formula Injection test
        note: '+Excel note',
        hme: 'csv2@example.com',
        forwardToEmail: 'forward@example.com',
        createTimestamp: 1609459200000,
      }),
    ];

    listHmeMock.mockResolvedValue({
      hmeEmails: csvEmails,
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    const createObjectURLMock = vi.fn().mockReturnValue('blob:url');
    const revokeObjectURLMock = vi.fn();
    const originalCreateObjectURL = globalThis.URL.createObjectURL;
    const originalRevokeObjectURL = globalThis.URL.revokeObjectURL;
    const originalCreateElement = document.createElement;

    try {
      globalThis.URL.createObjectURL = createObjectURLMock;
      globalThis.URL.revokeObjectURL = revokeObjectURLMock;

      const clickMock = vi.fn();
      document.createElement = vi.fn().mockImplementation((tagName) => {
        const element = originalCreateElement.call(document, tagName);
        if (tagName === 'a') {
          element.click = clickMock;
        }
        return element;
      });

      render(<Popup />);

      const exportButton = await screen.findByRole('button', {
        name: 'Export',
      });
      await act(async () => {
        await user.click(exportButton);
      });

      expect(createObjectURLMock).toHaveBeenCalled();
      const blob: Blob = createObjectURLMock.mock.calls[0][0];
      const reader = new FileReader();
      const textPromise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
      });
      reader.readAsText(blob);
      const text = await textPromise;

      const expectedCsv = [
        'email,label,note,isActive,forwardToEmail,createdAt',
        'csv1@example.com,"Label with , comma","Note with ""quotes"" and \n newlines",true,forward@example.com,2021-01-01T00:00:00.000Z',
        'csv2@example.com,"\'=SUM(1,2)",\'+Excel note,true,forward@example.com,2021-01-01T00:00:00.000Z',
      ].join('\r\n');

      expect(text).toBe(expectedCsv);

      // Verify formula injection risk: characters '=', '+', '-', '@' are sanitized in export
      expect(text).toContain(',"\'=SUM(1,2)",\'+Excel note,');
    } finally {
      globalThis.URL.createObjectURL = originalCreateObjectURL;
      globalThis.URL.revokeObjectURL = originalRevokeObjectURL;
      document.createElement = originalCreateElement;
    }
  });
});
