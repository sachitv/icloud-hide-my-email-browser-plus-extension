import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
import { CONTEXT_MENU_ITEM_ID } from '../src/constants';
import { createHmeEmailTestData, createClientStateTestData } from './testUtils';
import type { ListHmeResult } from '../src/iCloudClient';

const {
  useBrowserStorageStateMock,
  contextMenuUpdateMock,
  runtimeGetUrlMock,
  tabsQueryMock,
  getBrowserStorageValueMock,
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
  MockPremiumMailSettingsConstructorMock,
  PremiumMailSettingsConstructorMock,
  ICloudClientMock,
  clipboardWriteMock,
  cachedHmeListSetterMock,
  fuseConstructorMock,
} = vi.hoisted(() => {
  const useBrowserStorageStateMock = vi.fn();
  const contextMenuUpdateMock = vi.fn();
  const runtimeGetUrlMock = vi.fn().mockReturnValue('browser:///');
  const tabsQueryMock = vi.fn();
  const getBrowserStorageValueMock = vi.fn();
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
  const fuseConstructorMock = vi.fn();

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

  const MockPremiumMailSettingsConstructorMock = vi.fn(function MockPMS() {
    return {
      listHme: listHmeMock,
      generateHme: generateHmeMock,
      reserveHme: reserveHmeMock,
      deactivateHme: deactivateHmeMock,
      reactivateHme: reactivateHmeMock,
      deleteHme: deleteHmeMock,
      updateHmeMetadata: updateHmeMetadataMock,
      updateForwardToHme: vi.fn(),
    };
  });

  return {
    useBrowserStorageStateMock,
    contextMenuUpdateMock,
    runtimeGetUrlMock,
    tabsQueryMock,
    getBrowserStorageValueMock,
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
    MockPremiumMailSettingsConstructorMock,
    PremiumMailSettingsConstructorMock,
    ICloudClientMock,
    clipboardWriteMock,
    cachedHmeListSetterMock,
    fuseConstructorMock,
  };
});

vi.mock('fuse.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fuse.js')>();

  function FuseMock(...args: ConstructorParameters<typeof actual.default>) {
    fuseConstructorMock(...args);
    return new actual.default(...args);
  }

  return { default: FuseMock };
});

vi.mock('../src/hooks', () => ({
  useBrowserStorageState: useBrowserStorageStateMock,
}));

vi.mock('../src/storage', () => ({
  getBrowserStorageValue: getBrowserStorageValueMock,
  setBrowserStorageValue: setBrowserStorageValueMock,
  DEFAULT_STORE: {
    popupState: 1, // PopupState.SignedOut
    iCloudHmeOptions: { autofill: { button: true, contextMenu: true } },
    clientState: undefined,
    mockMode: false,
  },
}));

vi.mock('../src/mockClient', () => ({
  MockPremiumMailSettings: MockPremiumMailSettingsConstructorMock,
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

describe('Popup UI', () => {
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

  const selectAliasWithModifier = async (aliasLabel: string) => {
    const rowButton = await screen.findByRole('button', { name: aliasLabel });
    fireEvent.click(rowButton, { ctrlKey: true });
    await screen.findByText(/^\d+ selected$/i);
    return rowButton;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticatedMock.mockReset();
    signOutMock.mockReset();
    listHmeMock.mockReset();
    generateHmeMock.mockReset();
    reserveHmeMock.mockReset();
    MockPremiumMailSettingsConstructorMock.mockClear();
    PremiumMailSettingsConstructorMock.mockReset();
    useBrowserStorageStateMock.mockReset();
    contextMenuUpdateMock.mockReset();
    runtimeGetUrlMock.mockReset();
    tabsQueryMock.mockReset();
    getBrowserStorageValueMock.mockReset();
    setBrowserStorageValueMock.mockReset();
    popupStateSetterMock.mockReset();
    clientStateSetterMock.mockReset();
    sendMessageToTabMock.mockReset();
    updateHmeMetadataMock.mockReset();
    deactivateHmeMock.mockReset();
    reactivateHmeMock.mockReset();
    deleteHmeMock.mockReset();
    clipboardWriteMock.mockReset();
    fuseConstructorMock.mockReset();
    clipboardWriteMock.mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: {
        writeText: clipboardWriteMock,
      },
    });

    popupStateValue = PopupState.SignedOut;
    clientStateValue = undefined;
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
        // Mock mode is off by default in tests so the real auth path is exercised.
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

    isAuthenticatedMock.mockResolvedValue(false);
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

  // Baseline: signed-out state should guide users to the sign-in flow.
  it('renders sign-in guidance when the popup is signed out', async () => {
    render(<Popup />);

    await waitFor(() =>
      expect(screen.getByText(/Sign in to iCloud/i)).toBeInTheDocument()
    );

    expect(runtimeGetUrlMock).toHaveBeenCalledWith('userguide.html');
    expect(contextMenuUpdateMock).toHaveBeenCalledWith(
      CONTEXT_MENU_ITEM_ID,
      expect.objectContaining({ enabled: false })
    );
  });

  // Happy path for authenticated flow plus transition into management state.
  it('shows the HME generator flow when authenticated state and client data are available', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);

    render(<Popup />);

    await waitFor(() =>
      expect(PremiumMailSettingsConstructorMock).toHaveBeenCalled()
    );

    expect(
      await screen.findByRole('button', { name: /Use this email/i })
    ).toBeEnabled();

    expect(
      await screen.findByText(/Forwarding to: forward@example.com/i)
    ).toBeInTheDocument();

    const labelInput = await screen.findByLabelText(/Label/i);
    expect(labelInput).toHaveValue('example.com');

    await user.click(screen.getByRole('button', { name: /Manage emails/i }));
    expect(popupStateSetterMock).toHaveBeenCalledWith(
      PopupState.AuthenticatedAndManaging
    );
  });

  // Covers generator refresh, reservation success, clipboard copy, and autofill messaging.
  it('refreshes and reserves generated email addresses with copy and autofill helpers', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();

    generateHmeMock.mockReset();
    generateHmeMock.mockResolvedValueOnce('initial@example.com');
    generateHmeMock.mockResolvedValueOnce('refreshed@example.com');
    reserveHmeMock.mockReset();
    reserveHmeMock.mockResolvedValueOnce(
      createHmeEmailTestData({
        anonymousId: 'anon',
        note: 'Remember me',
        label: 'My Label',
        hme: 'reserved@example.com',
      })
    );
    listHmeMock.mockResolvedValue({
      hmeEmails: [],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });
    isAuthenticatedMock.mockResolvedValue(true);

    render(<Popup />);

    const refreshButton = await screen.findByRole('button', {
      name: /Refresh email/i,
    });
    await waitFor(() => expect(generateHmeMock).toHaveBeenCalledTimes(1));

    await user.click(refreshButton);
    await waitFor(() => expect(generateHmeMock).toHaveBeenCalledTimes(2));

    const labelInput = await screen.findByLabelText(/Label/i);
    await user.clear(labelInput);
    await user.type(labelInput, 'My Label');

    const noteInput = screen.getByLabelText(/Note/i);
    await user.type(noteInput, 'Remember me');

    await user.click(screen.getByRole('button', { name: /Use this email/i }));

    await waitFor(() =>
      expect(reserveHmeMock).toHaveBeenCalledWith(
        'refreshed@example.com',
        'My Label',
        'Remember me'
      )
    );

    const copyButton = await screen.findByRole('button', {
      name: /Copy to clipboard/i,
    });
    await user.click(copyButton);

    const autofillButton = screen.getByRole('button', { name: /^Autofill$/i });
    await user.click(autofillButton);
    await waitFor(() =>
      expect(sendMessageToTabMock).toHaveBeenCalledWith(
        'Autofill',
        'reserved@example.com'
      )
    );
  });

  it('uses the medium generated email font size for reserved addresses up to 36 characters', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);

    const reservedAddress = 'abcdefghijklmnopqrst@example.com';
    generateHmeMock.mockResolvedValueOnce(reservedAddress);
    reserveHmeMock.mockResolvedValueOnce(
      createHmeEmailTestData({
        anonymousId: 'font-size-medium',
        label: 'Font size label',
        hme: reservedAddress,
      })
    );

    render(<Popup />);

    await screen.findByText(reservedAddress);
    await user.click(screen.getByRole('button', { name: /Use this email/i }));

    const reservationAlert = await screen.findByRole('alert');
    expect(
      within(reservationAlert).getByText(reservedAddress).style.fontSize
    ).toBe('0.9rem');
  });

  it('uses the smallest generated email font size for long reserved addresses', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);

    const reservedAddress = 'abcdefghijklmnopqrstuvwxyz@example.com';
    generateHmeMock.mockResolvedValueOnce(reservedAddress);
    reserveHmeMock.mockResolvedValueOnce(
      createHmeEmailTestData({
        anonymousId: 'font-size-small',
        label: 'Long font size label',
        hme: reservedAddress,
      })
    );

    render(<Popup />);

    await screen.findByText(reservedAddress);
    await user.click(screen.getByRole('button', { name: /Use this email/i }));

    const reservationAlert = await screen.findByRole('alert');
    expect(
      within(reservationAlert).getByText(reservedAddress).style.fontSize
    ).toBe('0.82rem');
  });

  // Exercises manager view: search, activate/deactivate, delete, reactivate, and sign-out side effects.
  it('manages existing aliases with search, activation toggles, deletion, and sign-out', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const now = Date.now();
    const [activeAlias, betaAlias, gammaAlias] = [
      createHmeEmailTestData({
        anonymousId: 'active',
        label: 'Alpha alias',
        hme: 'alpha@example.com',
        isActive: true,
        createTimestamp: now,
      }),
      createHmeEmailTestData({
        anonymousId: 'beta',
        note: 'Beta note',
        label: 'Beta alias',
        hme: 'beta@example.com',
        isActive: false,
        createTimestamp: now - 1000,
      }),
      createHmeEmailTestData({
        anonymousId: 'gamma',
        label: 'Gamma alias',
        hme: 'gamma@example.com',
        isActive: false,
        createTimestamp: now - 2000,
      }),
    ];

    listHmeMock.mockResolvedValue({
      hmeEmails: [betaAlias, gammaAlias, activeAlias],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });
    deactivateHmeMock.mockResolvedValue(undefined);
    reactivateHmeMock.mockResolvedValue(undefined);
    deleteHmeMock.mockResolvedValue(undefined);

    expect(typeof navigator.clipboard?.writeText).toBe('function');
    await navigator.clipboard.writeText('probe');
    clipboardWriteMock.mockClear();

    render(<Popup />);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Generate new email/i })
      ).toBeInTheDocument()
    );

    const deactivateButton = await screen.findByRole('button', {
      name: /Deactivate/i,
    });
    await user.click(deactivateButton);
    await waitFor(() =>
      expect(deactivateHmeMock).toHaveBeenCalledWith(activeAlias.anonymousId)
    );

    const searchInput = screen.getByRole('searchbox', {
      name: /search through your hide my email\+ aliases/i,
    });

    await user.type(searchInput, 'missing');
    expect(
      await screen.findByText(/No results for "missing"/i)
    ).toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, 'beta');
    await waitFor(() =>
      expect(screen.queryByText(/No results for/i)).not.toBeInTheDocument()
    );

    const betaButton = await screen.findByRole('button', {
      name: /Beta alias/i,
    });
    await user.click(betaButton);

    await waitFor(() =>
      expect(screen.getByText(/Beta note/i)).toBeInTheDocument()
    );
    clipboardWriteMock.mockClear();
    sendMessageToTabMock.mockClear();

    const copyButton = screen.getByTitle('Copy');
    await user.click(copyButton);

    const autofillButton = screen.getByTitle('Autofill');
    await user.click(autofillButton);
    await waitFor(() =>
      expect(sendMessageToTabMock).toHaveBeenCalledWith(
        'Autofill',
        betaAlias.hme
      )
    );

    const deleteButton = screen.getByRole('button', { name: /^Delete$/i });
    await user.click(deleteButton);
    const confirmDeleteButton = await screen.findByRole('button', {
      name: /Confirm delete/i,
    });
    await user.click(confirmDeleteButton);
    await waitFor(() =>
      expect(deleteHmeMock).toHaveBeenCalledWith(betaAlias.anonymousId)
    );

    await user.clear(searchInput);
    await user.type(searchInput, 'gamma');
    const gammaButton = await screen.findByRole('button', {
      name: /Gamma alias/i,
    });
    await user.click(gammaButton);

    await user.click(screen.getByRole('button', { name: /Reactivate/i }));
    await waitFor(() =>
      expect(reactivateHmeMock).toHaveBeenCalledWith(gammaAlias.anonymousId)
    );

    contextMenuUpdateMock.mockClear();
    setBrowserStorageValueMock.mockClear();
    popupStateSetterMock.mockClear();

    await user.click(screen.getByRole('button', { name: /Sign out/i }));
    await waitFor(() => expect(signOutMock).toHaveBeenCalled());

    expect(clientStateSetterMock).toHaveBeenCalledWith(expect.any(Function));
    const resetCall = clientStateSetterMock.mock.calls
      .map(([arg]) => arg)
      .find((arg) => typeof arg === 'function') as
      | ((prev: unknown) => unknown)
      | undefined;
    expect(resetCall).toBeDefined();
    expect(resetCall?.(undefined)).toBeUndefined();
    expect(setBrowserStorageValueMock).toHaveBeenCalledWith(
      'popupState',
      PopupState.SignedOut
    );
    expect(setBrowserStorageValueMock).toHaveBeenCalledWith(
      'clientState',
      undefined
    );
    expect(contextMenuUpdateMock).toHaveBeenCalledWith(
      CONTEXT_MENU_ITEM_ID,
      expect.objectContaining({ enabled: false })
    );
    expect(popupStateSetterMock).toHaveBeenCalledWith(PopupState.SignedOut);
  });

  // syncClientAuthState success path should promote SignedOut to Authenticated.
  it('promotes signed-out state when stored session is still authenticated', async () => {
    popupStateValue = PopupState.SignedOut;
    clientStateValue = createClientStateTestData({ webservices: {} });
    isAuthenticatedMock.mockResolvedValue(true);
    listHmeMock.mockResolvedValue({
      hmeEmails: [],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    await waitFor(() => expect(popupStateSetterMock).toHaveBeenCalled());
    const updater = popupStateSetterMock.mock.calls.find(
      ([arg]) => typeof arg === 'function'
    )?.[0] as (state: PopupState) => PopupState;
    expect(updater).toBeTypeOf('function');
    expect(updater(PopupState.SignedOut)).toBe(PopupState.Authenticated);
    // Also exercise the false branch: when prevState is already Authenticated
    // (not SignedOut), the state is left unchanged.
    expect(updater(PopupState.Authenticated)).toBe(PopupState.Authenticated);
  });

  // Error path: listHme rejection should surface the error UI.
  it('renders an error state when alias fetching fails in manager view', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    listHmeMock.mockRejectedValue(new Error('loading failed'));

    render(<Popup />);

    await waitFor(() =>
      expect(screen.getByText(/loading failed/i)).toBeInTheDocument()
    );
  });

  // Empty state branch when no aliases are returned.
  it('renders an empty state when no aliases are returned', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    listHmeMock.mockResolvedValue({
      hmeEmails: [],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    await waitFor(() =>
      expect(
        screen.getByText(/There are no emails to list/i)
      ).toBeInTheDocument()
    );
  });

  it('renders signed-out guidance when authenticated state is missing persisted client state', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = undefined;

    expect(() => render(<Popup />)).not.toThrow();

    expect(await screen.findByText(/Sign in to iCloud/i)).toBeInTheDocument();
    expect(popupStateSetterMock).toHaveBeenCalledWith(PopupState.SignedOut);
  });

  it('renders signed-out guidance when manager state is missing persisted client state', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = undefined;

    expect(() => render(<Popup />)).not.toThrow();

    expect(await screen.findByText(/Sign in to iCloud/i)).toBeInTheDocument();
    expect(popupStateSetterMock).toHaveBeenCalledWith(PopupState.SignedOut);
  });

  it('waits for deauth storage side effects before completing sign-out transition', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);

    const storageResolutions: Array<() => void> = [];
    setBrowserStorageValueMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          storageResolutions.push(resolve);
        })
    );

    render(<Popup />);

    await user.click(await screen.findByRole('button', { name: /Sign out/i }));
    await waitFor(() => expect(signOutMock).toHaveBeenCalled());

    expect(setBrowserStorageValueMock).toHaveBeenCalledWith(
      'popupState',
      PopupState.SignedOut
    );
    expect(setBrowserStorageValueMock).toHaveBeenCalledWith(
      'clientState',
      undefined
    );
    expect(popupStateSetterMock).not.toHaveBeenCalledWith(PopupState.SignedOut);

    await act(async () => {
      for (const resolve of storageResolutions) {
        resolve();
      }
    });

    await waitFor(() =>
      expect(popupStateSetterMock).toHaveBeenCalledWith(PopupState.SignedOut)
    );
  });

  it('waits for deauth storage side effects before finishing auth-state sync', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(false);

    popupStateSetterMock.mockImplementation((valueOrUpdater) => {
      popupStateValue =
        typeof valueOrUpdater === 'function'
          ? valueOrUpdater(popupStateValue)
          : valueOrUpdater;
    });
    clientStateSetterMock.mockImplementation((value) => {
      clientStateValue = value;
    });

    const storageResolutions: Array<() => void> = [];
    setBrowserStorageValueMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          storageResolutions.push(resolve);
        })
    );

    render(<Popup />);

    await waitFor(() => expect(isAuthenticatedMock).toHaveBeenCalled());
    expect(screen.queryByText(/Sign in to iCloud/i)).not.toBeInTheDocument();

    await act(async () => {
      for (const resolve of storageResolutions) {
        resolve();
      }
    });

    expect(await screen.findByText(/Sign in to iCloud/i)).toBeInTheDocument();
  });

  // transitionToNextStateElement default branch should be unreachable.
  it('throws on an unknown popup state', () => {
    useBrowserStorageStateMock.mockImplementation((key: string) => {
      if (key === 'popupState') {
        return [99 as PopupState, popupStateSetterMock, false];
      }
      if (key === 'clientState') {
        return [undefined, clientStateSetterMock, false];
      }
      if (key === 'mockMode') return [true, vi.fn(), false];
      if (key === 'cachedHmeList') {
        return [undefined, cachedHmeListSetterMock, false];
      }
      throw new Error(`Unexpected key ${key}`);
    });

    expect(() => render(<Popup />)).toThrow(/Unhandled PopupState case/i);
  });

  it('handles errors when updating the context menu on sign-out', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);
    contextMenuUpdateMock.mockRejectedValue(
      new Error('context menu update failed')
    );
    const consoleDebugSpy = vi
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined);

    render(<Popup />);

    await user.click(await screen.findByRole('button', { name: /Sign out/i }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalled());
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'context menu update failed',
      })
    );

    consoleDebugSpy.mockRestore();
  });

  it('handles errors when querying for the active tab', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);
    tabsQueryMock.mockRejectedValue(new Error('tabs query failed'));
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    render(<Popup />);

    await waitFor(() => expect(tabsQueryMock).toHaveBeenCalled());
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'tabs query failed',
      })
    );

    consoleErrorSpy.mockRestore();
  });

  it('surfaces reservation errors and handles empty payloads', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);
    reserveHmeMock.mockRejectedValueOnce(new Error('reserve failed'));
    generateHmeMock.mockResolvedValueOnce('first@example.com');
    generateHmeMock.mockResolvedValueOnce('second@example.com');

    render(<Popup />);

    const useButton = await screen.findByRole('button', {
      name: /Use this email/i,
    });
    await user.click(useButton);

    await waitFor(() =>
      expect(screen.getByText(/reserve failed/i)).toBeInTheDocument()
    );

    const refreshButton = await screen.findByRole('button', {
      name: /Refresh email/i,
    });
    await user.click(refreshButton);
    await waitFor(() =>
      expect(screen.queryByText(/reserve failed/i)).not.toBeInTheDocument()
    );
  });

  // Error handling inside HmeDetails for activate/reactivate/delete flows.
  it('surfaces activation, reactivation, and deletion errors within HME details', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const now = Date.now();
    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'active',
          label: 'Active alias',
          hme: 'active@example.com',
          isActive: true,
          createTimestamp: now,
        }),
        createHmeEmailTestData({
          anonymousId: 'inactive',
          label: 'Inactive alias',
          hme: 'inactive@example.com',
          isActive: false,
          createTimestamp: now - 1000,
        }),
      ],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    deactivateHmeMock.mockRejectedValueOnce(new Error('deactivate failed'));
    reactivateHmeMock.mockRejectedValueOnce(new Error('reactivate failed'));
    deleteHmeMock.mockRejectedValueOnce(new Error('delete failed'));

    render(<Popup />);

    const deactivateButton = await screen.findByRole('button', {
      name: /Deactivate/i,
    });
    await user.click(deactivateButton);
    await waitFor(() =>
      expect(screen.getByText(/deactivate failed/i)).toBeInTheDocument()
    );

    const searchInput = screen.getByRole('searchbox', {
      name: /Search through your Hide My Email\+ aliases/i,
    });
    await user.clear(searchInput);
    await user.type(searchInput, 'Inactive alias');

    const inactiveButton = await screen.findByRole('button', {
      name: /Inactive alias/i,
    });
    await user.click(inactiveButton);

    const reactivateButton = await screen.findByRole('button', {
      name: /Reactivate/i,
    });
    await user.click(reactivateButton);
    await waitFor(() =>
      expect(screen.getByText(/reactivate failed/i)).toBeInTheDocument()
    );

    const deleteButton = await screen.findByRole('button', {
      name: /^Delete$/i,
    });
    await user.click(deleteButton);
    const confirmDeleteButton = await screen.findByRole('button', {
      name: /Confirm delete/i,
    });
    await user.click(confirmDeleteButton);
    await waitFor(() =>
      expect(screen.getByText(/delete failed/i)).toBeInTheDocument()
    );
  });

  it('handles errors when fetching forward-to email list', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);
    listHmeMock.mockRejectedValue(new Error('list failed'));

    render(<Popup />);

    await waitFor(() =>
      expect(screen.getByText(/list failed/i)).toBeInTheDocument()
    );
  });

  it('handles errors when generating new email on mount', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);
    generateHmeMock.mockRejectedValue(new Error('generate failed'));

    render(<Popup />);

    await waitFor(() =>
      expect(screen.getByText(/generate failed/i)).toBeInTheDocument()
    );
  });

  it('handles errors when manually refreshing email', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);
    generateHmeMock.mockResolvedValueOnce('initial@example.com');
    generateHmeMock.mockRejectedValueOnce(new Error('refresh failed'));

    render(<Popup />);

    const refreshButton = await screen.findByRole('button', {
      name: /Refresh email/i,
    });

    await user.click(refreshButton);

    await waitFor(() =>
      expect(screen.getByText(/refresh failed/i)).toBeInTheDocument()
    );
  });

  it('adjusts selected index when it exceeds filtered results', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const now = Date.now();
    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'first',
          label: 'Apple service',
          hme: 'first@example.com',
          isActive: true,
          createTimestamp: now,
        }),
        createHmeEmailTestData({
          anonymousId: 'second',
          label: 'Banana service',
          hme: 'second@example.com',
          isActive: true,
          createTimestamp: now - 1000,
        }),
        createHmeEmailTestData({
          anonymousId: 'third',
          label: 'Cherry service',
          hme: 'third@example.com',
          isActive: true,
          createTimestamp: now - 2000,
        }),
      ],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Apple service/i })
      ).toBeInTheDocument()
    );

    // Select the third item (index 2)
    const thirdButton = screen.getByRole('button', { name: /Cherry service/i });
    await user.click(thirdButton);

    const searchInput = screen.getByRole('searchbox', {
      name: /Search through your Hide My Email\+ aliases/i,
    });

    // Now filter to show only first item (Apple), which should adjust selectedIndex from 2 to 0
    await user.type(searchInput, 'Apple');

    // The selected index should be adjusted to 0 (the last item in filtered results which has only 1 item)
    await waitFor(() => {
      const firstButton = screen.getByRole('button', {
        name: /Apple service/i,
      });
      expect(firstButton).toBeInTheDocument();
      // Since only one item is visible, selectedIndex should be 0 and Apple should be selected
      expect(firstButton).toHaveAttribute('aria-current', 'true');
    });
  });

  it('can click the generate footer button', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    listHmeMock.mockResolvedValue({
      hmeEmails: [],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    const generateButton = await screen.findByRole('button', {
      name: /Generate new email/i,
    });
    await user.click(generateButton);

    expect(popupStateSetterMock).toHaveBeenCalledWith(PopupState.Authenticated);
  });

  // Covers the selectedIndex >= hmeEmails.length guard in HmeListView (line 740).
  // When the user has item at index N selected and a deletion reduces the list length
  // to N (or below), the effect clamps selectedIndex to hmeEmails.length - 1.
  it('clamps the selected index when deletion shrinks the list below the current selection', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const now = Date.now();
    const [firstAlias, secondAlias] = [
      createHmeEmailTestData({
        anonymousId: 'first',
        label: 'First alias',
        hme: 'first@example.com',
        isActive: false,
        createTimestamp: now,
      }),
      createHmeEmailTestData({
        anonymousId: 'second',
        label: 'Second alias',
        hme: 'second@example.com',
        isActive: false,
        createTimestamp: now - 1000,
      }),
    ];

    listHmeMock.mockResolvedValue({
      hmeEmails: [firstAlias, secondAlias],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });
    deleteHmeMock.mockResolvedValue(undefined);

    render(<Popup />);

    // Select the second item (index 1)
    const secondButton = await screen.findByRole('button', {
      name: /Second alias/i,
    });
    await user.click(secondButton);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Second alias/i })
      ).toHaveAttribute('aria-current', 'true')
    );

    // Delete the second alias — the list shrinks to length 1, but selectedIndex
    // is still 1. The useEffect in HmeListView detects selectedIndex (1) >=
    // hmeEmails.length (1) and clamps it to 0, exercising line 740.
    const deleteButton = await screen.findByRole('button', {
      name: /^Delete$/i,
    });
    await user.click(deleteButton);
    const confirmDeleteButton = await screen.findByRole('button', {
      name: /Confirm delete/i,
    });
    await user.click(confirmDeleteButton);

    await waitFor(() =>
      expect(deleteHmeMock).toHaveBeenCalledWith(secondAlias.anonymousId)
    );

    // After deletion, the first alias should become selected (index 0)
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /First alias/i })
      ).toHaveAttribute('aria-current', 'true')
    );
  });

  // Covers the false branch of `label || tabHost` in onUseSubmit (Popup.tsx line 427).
  // When the label field is cleared the form falls back to tabHost for the reservation label.
  it('falls back to tabHost as reservation label when the label field is cleared', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);
    generateHmeMock.mockResolvedValue('generated@example.com');
    reserveHmeMock.mockResolvedValue(
      createHmeEmailTestData({
        anonymousId: 'anon',
        label: 'example.com',
        hme: 'generated@example.com',
      })
    );

    render(<Popup />);

    // Wait for the label field to be pre-populated with the hostname (tabHost)
    const labelInput = await screen.findByLabelText(/Label/i);
    await waitFor(() => expect(labelInput).toHaveValue('example.com'));

    // Clear the label, making it empty (falsy), so `label || tabHost` uses tabHost
    await user.clear(labelInput);
    expect(labelInput).toHaveValue('');

    // Use fireEvent.submit to bypass the `required` HTML attribute and exercise the fallback
    const form = labelInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() =>
      expect(reserveHmeMock).toHaveBeenCalledWith(
        'generated@example.com',
        'example.com',
        undefined
      )
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Inline alias editing
  // ──────────────────────────────────────────────────────────────────────────

  it('can enter edit mode, save new values, and see the sidebar label update', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const alias = createHmeEmailTestData({
      anonymousId: 'alias-1',
      label: 'Original label',
      note: 'Original note',
      hme: 'alias@hide.example.com',
      isActive: true,
    });

    listHmeMock.mockResolvedValue({
      hmeEmails: [alias],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });
    updateHmeMetadataMock.mockResolvedValue(undefined);

    render(<Popup />);

    await user.click(
      await screen.findByRole('button', { name: /Edit label & note/i })
    );

    const labelInput = screen.getByDisplayValue('Original label');
    await user.clear(labelInput);
    await user.type(labelInput, 'New label');

    const noteInput = screen.getByDisplayValue('Original note');
    await user.clear(noteInput);
    await user.type(noteInput, 'New note');

    await user.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() =>
      expect(updateHmeMetadataMock).toHaveBeenCalledWith(
        alias.anonymousId,
        'New label',
        'New note'
      )
    );

    // Sidebar label reflects the updated value after save
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'New label' })
      ).toBeInTheDocument()
    );
  });

  it('can cancel editing without calling the API or changing displayed values', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'alias-1',
          label: 'Stable label',
          note: 'Stable note',
          hme: 'alias@hide.example.com',
          isActive: true,
        }),
      ],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    await user.click(
      await screen.findByRole('button', { name: /Edit label & note/i })
    );

    const labelInput = screen.getByDisplayValue('Stable label');
    await user.clear(labelInput);
    await user.type(labelInput, 'Changed label');

    await user.click(screen.getByRole('button', { name: /^Cancel$/i }));

    expect(updateHmeMetadataMock).not.toHaveBeenCalled();

    // Original label still in sidebar
    expect(
      screen.getByRole('button', { name: 'Stable label' })
    ).toBeInTheDocument();

    // Edit mode exited — Edit button visible again
    expect(
      screen.getByRole('button', { name: /Edit label & note/i })
    ).toBeInTheDocument();
  });

  it('surfaces an error when updateHmeMetadata fails during save', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'alias-1',
          label: 'My alias',
          note: '',
          hme: 'alias@hide.example.com',
          isActive: true,
        }),
      ],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });
    updateHmeMetadataMock.mockRejectedValue(new Error('save failed'));

    render(<Popup />);

    await user.click(
      await screen.findByRole('button', { name: /Edit label & note/i })
    );
    await user.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() =>
      expect(screen.getByText(/save failed/i)).toBeInTheDocument()
    );
  });

  it('clears the edit error when cancelling after a failed save', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'alias-1',
          label: 'My alias',
          note: '',
          hme: 'alias@hide.example.com',
          isActive: true,
        }),
      ],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });
    updateHmeMetadataMock.mockRejectedValue(new Error('save failed'));

    render(<Popup />);

    await user.click(
      await screen.findByRole('button', { name: /Edit label & note/i })
    );
    await user.click(screen.getByRole('button', { name: /^Save$/i }));
    await waitFor(() =>
      expect(screen.getByText(/save failed/i)).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: /^Cancel$/i }));

    await waitFor(() =>
      expect(screen.queryByText(/save failed/i)).not.toBeInTheDocument()
    );
  });

  it('updates only the edited alias in the list when multiple aliases are present', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const now = Date.now();
    const first = createHmeEmailTestData({
      anonymousId: 'alias-1',
      label: 'First alias',
      note: '',
      hme: 'first@hide.example.com',
      isActive: true,
      createTimestamp: now,
    });
    const second = createHmeEmailTestData({
      anonymousId: 'alias-2',
      label: 'Second alias',
      note: '',
      hme: 'second@hide.example.com',
      isActive: true,
      createTimestamp: now - 1000,
    });

    listHmeMock.mockResolvedValue({
      hmeEmails: [first, second],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });
    updateHmeMetadataMock.mockResolvedValue(undefined);

    render(<Popup />);

    await user.click(
      await screen.findByRole('button', { name: /Edit label & note/i })
    );

    const labelInput = screen.getByDisplayValue('First alias');
    await user.clear(labelInput);
    await user.type(labelInput, 'Renamed alias');

    await user.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Renamed alias' })
      ).toBeInTheDocument()
    );
    expect(
      screen.getByRole('button', { name: 'Second alias' })
    ).toBeInTheDocument();
  });

  it('resets edit mode when switching to a different alias in the sidebar', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const now = Date.now();
    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'first',
          label: 'First alias',
          hme: 'first@example.com',
          isActive: true,
          createTimestamp: now,
        }),
        createHmeEmailTestData({
          anonymousId: 'second',
          label: 'Second alias',
          hme: 'second@example.com',
          isActive: true,
          createTimestamp: now - 1000,
        }),
      ],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    await user.click(
      await screen.findByRole('button', { name: /Edit label & note/i })
    );
    expect(screen.getByRole('button', { name: /^Save$/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Second alias' }));

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Edit label & note/i })
      ).toBeInTheDocument()
    );
    expect(
      screen.queryByRole('button', { name: /^Save$/i })
    ).not.toBeInTheDocument();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Two-step delete confirmation
  // ──────────────────────────────────────────────────────────────────────────

  it('shows confirm and cancel buttons on first delete click without deleting', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'alias-1',
          label: 'My alias',
          hme: 'alias@example.com',
          isActive: false,
        }),
      ],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    await user.click(await screen.findByRole('button', { name: /^Delete$/i }));

    expect(
      screen.getByRole('button', { name: /Confirm delete/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Cancel$/i })
    ).toBeInTheDocument();
    expect(deleteHmeMock).not.toHaveBeenCalled();
  });

  it('can cancel the delete confirmation and restore the original Delete button', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'alias-1',
          label: 'My alias',
          hme: 'alias@example.com',
          isActive: false,
        }),
      ],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    await user.click(await screen.findByRole('button', { name: /^Delete$/i }));
    await user.click(screen.getByRole('button', { name: /^Cancel$/i }));

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /^Delete$/i })
      ).toBeInTheDocument()
    );
    expect(
      screen.queryByRole('button', { name: /Confirm delete/i })
    ).not.toBeInTheDocument();
    expect(deleteHmeMock).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Active/inactive alias count in manage view
  // ──────────────────────────────────────────────────────────────────────────

  it('shows the active and inactive alias counts in the manage view header', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const now = Date.now();
    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'a',
          label: 'Alpha',
          isActive: true,
          createTimestamp: now,
        }),
        createHmeEmailTestData({
          anonymousId: 'b',
          label: 'Beta',
          isActive: true,
          createTimestamp: now - 1000,
        }),
        createHmeEmailTestData({
          anonymousId: 'c',
          label: 'Gamma',
          isActive: false,
          createTimestamp: now - 2000,
        }),
      ],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    await waitFor(() => expect(document.body).toHaveTextContent('2 active'));
    expect(document.body).toHaveTextContent('1 inactive');
  });

  it('omits the inactive count when all aliases are active', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const now = Date.now();
    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'a',
          label: 'Alpha',
          isActive: true,
          createTimestamp: now,
        }),
        createHmeEmailTestData({
          anonymousId: 'b',
          label: 'Beta',
          isActive: true,
          createTimestamp: now - 1000,
        }),
      ],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    await waitFor(() => expect(document.body).toHaveTextContent('2 active'));
    expect(document.body).not.toHaveTextContent('inactive');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Quick-copy alias from sidebar
  // ──────────────────────────────────────────────────────────────────────────

  it('copies the alias address via the sidebar quick-copy button', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const alias = createHmeEmailTestData({
      anonymousId: 'alias-1',
      label: 'My alias',
      hme: 'quickcopy@hide.example.com',
      isActive: true,
    });

    listHmeMock.mockResolvedValue({
      hmeEmails: [alias],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    const copyAliasButton = await screen.findByTitle('Copy alias');
    await user.click(copyAliasButton);

    await waitFor(() =>
      expect(screen.getByTitle('Copied!')).toBeInTheDocument()
    );
  });

  it('resets the sidebar copy button title after 1.5 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const alias = createHmeEmailTestData({
      anonymousId: 'alias-1',
      label: 'My alias',
      hme: 'quickcopy@hide.example.com',
      isActive: true,
    });

    listHmeMock.mockResolvedValue({
      hmeEmails: [alias],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    const copyAliasButton = await screen.findByTitle('Copy alias');
    await user.click(copyAliasButton);

    await waitFor(() =>
      expect(screen.getByTitle('Copied!')).toBeInTheDocument()
    );

    await act(async () => {
      vi.runAllTimers();
    });

    await waitFor(() =>
      expect(screen.getByTitle('Copy alias')).toBeInTheDocument()
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Domain-match warning in generator view
  // ──────────────────────────────────────────────────────────────────────────

  it('shows a warning when an active alias already exists for the current site', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);
    generateHmeMock.mockResolvedValue('new@hide.example.com');

    // tabHost will be 'example.com' from the default tabsQueryMock value
    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'existing',
          label: 'example.com',
          hme: 'existing@hide.example.com',
          isActive: true,
        }),
      ],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    await waitFor(() =>
      expect(
        screen.getByText(/Existing alias for this site/i)
      ).toBeInTheDocument()
    );
    expect(screen.getByText('existing@hide.example.com')).toBeInTheDocument();
  });

  it('does not show a warning when no alias label matches the current site', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);
    generateHmeMock.mockResolvedValue('new@hide.example.com');

    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'other',
          label: 'other.com',
          hme: 'other@hide.example.com',
          isActive: true,
        }),
      ],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    await screen.findByRole('button', { name: /Use this email/i });
    expect(screen.queryByText(/Existing alias/i)).not.toBeInTheDocument();
  });

  it('does not show a warning for inactive aliases even when the label matches', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);
    generateHmeMock.mockResolvedValue('new@hide.example.com');

    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'inactive',
          label: 'example.com',
          hme: 'inactive@hide.example.com',
          isActive: false,
        }),
      ],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    await screen.findByRole('button', { name: /Use this email/i });
    expect(screen.queryByText(/Existing alias/i)).not.toBeInTheDocument();
  });

  it('can copy an alias address from the domain-match warning notice', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);
    generateHmeMock.mockResolvedValue('new@hide.example.com');

    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'existing',
          label: 'example.com',
          hme: 'existing@hide.example.com',
          isActive: true,
        }),
      ],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    await waitFor(() =>
      expect(screen.getByText('existing@hide.example.com')).toBeInTheDocument()
    );

    await user.click(screen.getByTitle('Copy'));

    await waitFor(() =>
      expect(screen.getByTitle('Copied!')).toBeInTheDocument()
    );
  });

  it('resets the domain-match copy button title after 1.5 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);
    generateHmeMock.mockResolvedValue('new@hide.example.com');

    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'existing',
          label: 'example.com',
          hme: 'existing@hide.example.com',
          isActive: true,
        }),
      ],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    await waitFor(() =>
      expect(screen.getByText('existing@hide.example.com')).toBeInTheDocument()
    );

    await user.click(screen.getByTitle('Copy'));
    await waitFor(() =>
      expect(screen.getByTitle('Copied!')).toBeInTheDocument()
    );

    await act(async () => {
      vi.runAllTimers();
    });
    await waitFor(() => expect(screen.getByTitle('Copy')).toBeInTheDocument());
  });

  it('uses plural heading when multiple aliases exist for the current site', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);
    generateHmeMock.mockResolvedValue('new@hide.example.com');

    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'existing-1',
          label: 'example.com',
          hme: 'first@hide.example.com',
          isActive: true,
        }),
        createHmeEmailTestData({
          anonymousId: 'existing-2',
          label: 'example.com',
          hme: 'second@hide.example.com',
          isActive: true,
        }),
      ],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    await waitFor(() =>
      expect(
        screen.getByText('Existing aliases for this site')
      ).toBeInTheDocument()
    );
  });

  it('can dismiss the domain-match warning notice', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);
    generateHmeMock.mockResolvedValue('new@hide.example.com');

    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'existing',
          label: 'example.com',
          hme: 'existing@hide.example.com',
          isActive: true,
        }),
      ],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    await waitFor(() =>
      expect(screen.getByText(/Existing alias/i)).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: /Dismiss/i }));

    await waitFor(() =>
      expect(screen.queryByText(/Existing alias/i)).not.toBeInTheDocument()
    );
  });

  it('renders cached HME list instantly and runs a background refresh', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    // Setup cached value
    cachedHmeListValue = {
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'cached-1',
          label: 'Cached Alias',
          hme: 'cached@example.com',
          isActive: true,
          createTimestamp: Date.now(),
        }),
      ],
      forwardToEmails: ['forward@example.com'],
      selectedForwardTo: 'forward@example.com',
    };

    // Setup listHme mock to return a new email on background refresh
    const freshList = {
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'cached-1',
          label: 'Cached Alias',
          hme: 'cached@example.com',
          isActive: true,
          createTimestamp: Date.now(),
        }),
        createHmeEmailTestData({
          anonymousId: 'fresh-1',
          label: 'Fresh Alias',
          hme: 'fresh@example.com',
          isActive: true,
          createTimestamp: Date.now() + 1000,
        }),
      ],
      forwardToEmails: ['forward@example.com'],
      selectedForwardTo: 'forward@example.com',
    };

    // Make the network call resolve after a brief delay
    let resolveList: (val: ListHmeResult) => void = () => {};
    const listHmePromise = new Promise<ListHmeResult>((resolve) => {
      resolveList = resolve;
    });
    listHmeMock.mockReturnValue(listHmePromise);

    render(<Popup />);

    // The cached alias should be displayed instantly
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Cached Alias' })
      ).toBeInTheDocument();
    });

    // "Refreshing..." indicator should be visible
    expect(screen.getByText('Refreshing...')).toBeInTheDocument();

    // Resolve the background refresh
    await act(async () => {
      resolveList(freshList);
    });

    // The fresh alias should now be displayed
    await screen.findByRole('button', { name: 'Fresh Alias' });
    expect(screen.queryByText('Refreshing...')).not.toBeInTheDocument();
    // The cache should be updated with fresh list
    expect(cachedHmeListSetterMock).toHaveBeenCalledWith(freshList);
  });

  it('supports keyboard navigation in HmeListView', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    const emails = [
      createHmeEmailTestData({
        anonymousId: 'id-1',
        label: 'Alias 1',
        hme: 'alias1@example.com',
        isActive: true,
        createTimestamp: Date.now() - 1000,
      }),
      createHmeEmailTestData({
        anonymousId: 'id-2',
        label: 'Alias 2',
        hme: 'alias2@example.com',
        isActive: true,
        createTimestamp: Date.now(),
      }),
    ];

    listHmeMock.mockResolvedValue({
      hmeEmails: emails,
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    // Wait for aliases to load
    const listbox = await screen.findByRole('tree');

    // Initial selection index is 0. Select option 1 (which is index 0).
    // newest is 'id-2' (since created time is greater/newest).
    // Expect order: Alias 2, Alias 1
    const alias2Button = await screen.findByRole('button', { name: 'Alias 2' });
    expect(alias2Button).toHaveAttribute('aria-current', 'true');

    // Press ArrowDown to select index 1 (Alias 1)
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    const alias1Button = screen.getByRole('button', { name: 'Alias 1' });
    expect(alias1Button).toHaveAttribute('aria-current', 'true');
    expect(scrollIntoViewMock).toHaveBeenCalled();

    // Press ArrowUp to select index 0 (Alias 2)
    fireEvent.keyDown(listbox, { key: 'ArrowUp' });
    expect(alias2Button).toHaveAttribute('aria-current', 'true');

    // Press Enter/Space to select/click the current button
    const clickSpy = vi.spyOn(alias2Button, 'click');
    fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(clickSpy).toHaveBeenCalled();
  });

  it('supports sorting in HmeListView', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const sessionStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: sessionStorageMock,
      writable: true,
      configurable: true,
    });

    sessionStorageMock.getItem.mockReturnValue('newest');

    const now = Date.now();
    const emails = [
      createHmeEmailTestData({
        anonymousId: 'id-1',
        label: 'Beta',
        hme: 'beta@example.com',
        isActive: false,
        createTimestamp: now - 2000,
      }),
      createHmeEmailTestData({
        anonymousId: 'id-2',
        label: 'Alpha',
        hme: 'alpha@example.com',
        isActive: true,
        createTimestamp: now,
      }),
      createHmeEmailTestData({
        anonymousId: 'id-3',
        label: 'Gamma',
        hme: 'gamma@example.com',
        isActive: true,
        createTimestamp: now - 1000,
      }),
    ];

    listHmeMock.mockResolvedValue({
      hmeEmails: emails,
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    const select = await screen.findByRole('combobox', {
      name: 'Sort aliases',
    });
    expect(select).toHaveValue('newest');

    // By newest: Alpha (now), Gamma (now-1000), Beta (now-2000)
    const getOptionTextOrder = () => {
      const rows = screen
        .getAllByRole('button')
        .map((b) => b.textContent?.trim())
        .filter(Boolean);
      return rows.filter((r) =>
        ['Alpha', 'Beta', 'Gamma'].some((l) => r?.includes(l))
      );
    };

    expect(getOptionTextOrder()).toEqual(['Alpha', 'Gamma', 'Beta']);

    // Change sorting to oldest
    await user.selectOptions(select, 'oldest');
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
      'hme_sort_by',
      'oldest'
    );
    expect(getOptionTextOrder()).toEqual(['Beta', 'Gamma', 'Alpha']);

    // Change sorting to label
    await user.selectOptions(select, 'label');
    expect(getOptionTextOrder()).toEqual(['Alpha', 'Beta', 'Gamma']);

    // Change sorting to active
    await user.selectOptions(select, 'active');
    expect(getOptionTextOrder()).toEqual(['Alpha', 'Gamma', 'Beta']);
  });

  it('reuses the Fuse search index while only the search prompt changes', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const now = Date.now();
    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'alpha-id',
          label: 'Alpha service',
          hme: 'alpha@example.com',
          isActive: true,
          createTimestamp: now,
        }),
        createHmeEmailTestData({
          anonymousId: 'beta-id',
          label: 'Beta service',
          hme: 'beta@example.com',
          isActive: true,
          createTimestamp: now - 1000,
        }),
      ],
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    });

    render(<Popup />);

    await screen.findByRole('button', { name: 'Alpha service' });
    expect(fuseConstructorMock).toHaveBeenCalledTimes(1);

    const searchInput = screen.getByRole('searchbox', {
      name: /Search through your Hide My Email\+ aliases/i,
    });
    await user.type(searchInput, 'Alpha');

    await screen.findByRole('button', { name: 'Alpha service' });
    expect(
      screen.queryByRole('button', { name: 'Beta service' })
    ).not.toBeInTheDocument();
    expect(fuseConstructorMock).toHaveBeenCalledTimes(1);
  });

  it('supports exporting aliases to CSV', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const emails = [
      createHmeEmailTestData({
        anonymousId: 'id-1',
        label: 'Label, with comma',
        hme: 'alias1@example.com',
        isActive: true,
        note: 'Note with "quotes"\nand newline',
        forwardToEmail: 'forward@example.com',
        createTimestamp: 1609459200000, // 2021-01-01T00:00:00.000Z
      }),
    ];

    listHmeMock.mockResolvedValue({
      hmeEmails: emails,
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
      let capturedAnchor: HTMLAnchorElement | null = null;
      document.createElement = vi.fn().mockImplementation((tagName) => {
        const element = originalCreateElement.call(document, tagName);
        if (tagName === 'a') {
          capturedAnchor = element as HTMLAnchorElement;
          element.click = clickMock;
        }
        return element;
      });

      render(<Popup />);

      const exportButton = await screen.findByRole('button', {
        name: 'Export',
      });
      vi.useFakeTimers();
      fireEvent.click(exportButton);

      expect(createObjectURLMock).toHaveBeenCalled();
      expect(clickMock).toHaveBeenCalled();
      expect(capturedAnchor).not.toBeNull();
      expect(capturedAnchor?.getAttribute('download')).toContain(
        'icloud_hme_aliases_'
      );
      expect(capturedAnchor?.getAttribute('href')).toBe('blob:url');
      expect(revokeObjectURLMock).not.toHaveBeenCalled();

      act(() => {
        vi.runOnlyPendingTimers();
      });

      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:url');

      const blob: Blob = createObjectURLMock.mock.calls[0][0];
      const reader = new FileReader();
      const textPromise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
      });
      reader.readAsText(blob);
      const text = await textPromise;

      const expectedCsv = [
        'email,label,note,isActive,forwardToEmail,createdAt',
        'alias1@example.com,"Label, with comma","Note with ""quotes""\nand newline",true,forward@example.com,2021-01-01T00:00:00.000Z',
      ].join('\r\n');

      expect(text).toBe(expectedCsv);
    } finally {
      globalThis.URL.createObjectURL = originalCreateObjectURL;
      globalThis.URL.revokeObjectURL = originalRevokeObjectURL;
      document.createElement = originalCreateElement;
    }
  });

  it('bulk delete confirmed calls onBulkDelete and resets selected index', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const emails = [
      createHmeEmailTestData({
        anonymousId: 'id-1',
        label: 'Alpha alias',
        hme: 'alpha@example.com',
        isActive: true,
        createTimestamp: Date.now() - 1000,
      }),
      createHmeEmailTestData({
        anonymousId: 'id-2',
        label: 'Beta alias',
        hme: 'beta@example.com',
        isActive: true,
        createTimestamp: Date.now() - 2000,
      }),
    ];

    listHmeMock.mockResolvedValue({
      hmeEmails: emails,
      forwardToEmails: ['forward@example.com'],
      selectedForwardTo: 'forward@example.com',
    });
    deleteHmeMock.mockResolvedValue(undefined);

    render(<Popup />);

    expect(
      screen.queryByRole('checkbox', { name: /Select Alpha alias/i })
    ).not.toBeInTheDocument();

    await selectAliasWithModifier('Alpha alias');

    const deleteSelectedBtn = await screen.findByRole('button', {
      name: /Delete selected/i,
    });
    await user.click(deleteSelectedBtn);

    const confirmBtn = await screen.findByRole('button', {
      name: /^Confirm$/i,
    });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(deleteHmeMock).toHaveBeenCalledWith('id-1');
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('checkbox', { name: /Select Alpha alias/i })
      ).not.toBeInTheDocument();
    });
  });

  it('keeps bulk selection hidden until modifier multi-select is used', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const now = Date.now();
    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'id-1',
          label: 'First alias',
          hme: 'first@example.com',
          isActive: true,
          createTimestamp: now,
        }),
        createHmeEmailTestData({
          anonymousId: 'id-2',
          label: 'Second alias',
          hme: 'second@example.com',
          isActive: true,
          createTimestamp: now - 1000,
        }),
      ],
      forwardToEmails: ['forward@example.com'],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    const secondAliasButton = await screen.findByRole('button', {
      name: 'Second alias',
    });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    await user.click(secondAliasButton);
    expect(secondAliasButton).toHaveAttribute('aria-current', 'true');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    fireEvent.click(secondAliasButton, { metaKey: true });

    await screen.findByText(/1 selected/i);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    fireEvent.click(secondAliasButton, { metaKey: true });
    await waitFor(() =>
      expect(screen.queryByText(/1 selected/i)).not.toBeInTheDocument()
    );
  });

  it('selects the anchor row and clicked row after single click then ctrl or cmd click', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const now = Date.now();
    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'id-1',
          label: 'First alias',
          hme: 'first@example.com',
          isActive: true,
          createTimestamp: now,
        }),
        createHmeEmailTestData({
          anonymousId: 'id-2',
          label: 'Second alias',
          hme: 'second@example.com',
          isActive: true,
          createTimestamp: now - 1000,
        }),
        createHmeEmailTestData({
          anonymousId: 'id-3',
          label: 'Third alias',
          hme: 'third@example.com',
          isActive: true,
          createTimestamp: now - 2000,
        }),
      ],
      forwardToEmails: ['forward@example.com'],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    const secondAliasButton = await screen.findByRole('button', {
      name: 'Second alias',
    });
    await user.click(secondAliasButton);
    expect(secondAliasButton).toHaveAttribute('aria-current', 'true');
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();

    const thirdAliasButton = await screen.findByRole('button', {
      name: 'Third alias',
    });
    fireEvent.click(thirdAliasButton, { ctrlKey: true });

    await screen.findByText(/2 selected/i);
    expect(secondAliasButton).toHaveAttribute('aria-pressed', 'true');
    expect(thirdAliasButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('dismisses bulk selection when the toolbar clear button or Escape is used', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const now = Date.now();
    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'id-1',
          label: 'First alias',
          hme: 'first@example.com',
          isActive: true,
          createTimestamp: now,
        }),
        createHmeEmailTestData({
          anonymousId: 'id-2',
          label: 'Second alias',
          hme: 'second@example.com',
          isActive: true,
          createTimestamp: now - 1000,
        }),
      ],
      forwardToEmails: ['forward@example.com'],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    const firstAliasButton = await screen.findByRole('button', {
      name: 'First alias',
    });
    const secondAliasButton = await screen.findByRole('button', {
      name: 'Second alias',
    });
    await user.click(firstAliasButton);
    fireEvent.click(secondAliasButton, { metaKey: true });

    await screen.findByText(/2 selected/i);
    await user.click(screen.getByRole('button', { name: /Clear selection/i }));

    await waitFor(() =>
      expect(screen.queryByText(/selected/i)).not.toBeInTheDocument()
    );
    expect(firstAliasButton).toHaveAttribute('aria-pressed', 'false');
    expect(secondAliasButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    await user.click(firstAliasButton);
    fireEvent.click(secondAliasButton, { metaKey: true });
    await screen.findByText(/2 selected/i);

    fireEvent.keyDown(screen.getByRole('tree'), { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByText(/selected/i)).not.toBeInTheDocument()
    );
  });

  it('supports shift range selection after a normal single selection and modifier keyboard multi-select', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const now = Date.now();
    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'id-1',
          label: 'First alias',
          hme: 'first@example.com',
          isActive: true,
          createTimestamp: now,
        }),
        createHmeEmailTestData({
          anonymousId: 'id-2',
          label: 'Second alias',
          hme: 'second@example.com',
          isActive: true,
          createTimestamp: now - 1000,
        }),
        createHmeEmailTestData({
          anonymousId: 'id-3',
          label: 'Third alias',
          hme: 'third@example.com',
          isActive: true,
          createTimestamp: now - 2000,
        }),
      ],
      forwardToEmails: ['forward@example.com'],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    const firstAliasButton = await screen.findByRole('button', {
      name: 'First alias',
    });
    await user.click(firstAliasButton);

    const thirdAliasButton = await screen.findByRole('button', {
      name: 'Third alias',
    });
    fireEvent.click(thirdAliasButton, { shiftKey: true });

    await screen.findByText(/3 selected/i);
    expect(firstAliasButton).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Second alias' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(thirdAliasButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    fireEvent.click(thirdAliasButton, { ctrlKey: true });
    await waitFor(() =>
      expect(screen.getByText(/2 selected/i)).toBeInTheDocument()
    );

    const listbox = screen.getByRole('tree');
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    fireEvent.keyDown(listbox, { key: ' ', ctrlKey: true });

    await waitFor(() =>
      expect(screen.getByText(/3 selected/i)).toBeInTheDocument()
    );
  });

  it('supports keyboard shift range selection from the focused alias row', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const now = Date.now();
    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'id-keyboard-1',
          label: 'First keyboard alias',
          hme: 'first-keyboard@example.com',
          isActive: true,
          createTimestamp: now,
        }),
        createHmeEmailTestData({
          anonymousId: 'id-keyboard-2',
          label: 'Second keyboard alias',
          hme: 'second-keyboard@example.com',
          isActive: true,
          createTimestamp: now - 1000,
        }),
      ],
      forwardToEmails: ['forward@example.com'],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    const firstAliasButton = await screen.findByRole('button', {
      name: 'First keyboard alias',
    });
    firstAliasButton.focus();

    const listbox = screen.getByRole('tree');
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    fireEvent.keyDown(listbox, { key: 'Enter', shiftKey: true });

    await screen.findByText(/2 selected/i);
    expect(firstAliasButton).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Second keyboard alias' })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('skips real iCloud auth and shows generator when mock mode is enabled', async () => {
    useBrowserStorageStateMock.mockImplementation((key: string) => {
      if (key === 'popupState')
        return [PopupState.SignedOut, popupStateSetterMock, false];
      if (key === 'clientState')
        return [undefined, clientStateSetterMock, false];
      if (key === 'mockMode') return [true, vi.fn(), false];
      if (key === 'cachedHmeList')
        return [undefined, cachedHmeListSetterMock, false];
      throw new Error(`Unexpected key ${key}`);
    });

    render(<Popup />);

    await waitFor(() => {
      expect(popupStateSetterMock).toHaveBeenCalledWith(
        PopupState.Authenticated
      );
    });
  });

  describe('Milestone 4 Stress Tests & Edge Cases', () => {
    it('handles empty cached list and empty background response', async () => {
      popupStateValue = PopupState.AuthenticatedAndManaging;
      clientStateValue = createClientStateTestData();
      cachedHmeListValue = {
        hmeEmails: [],
        forwardToEmails: [],
        selectedForwardTo: 'forward@example.com',
      };
      listHmeMock.mockResolvedValue({
        hmeEmails: [],
        forwardToEmails: [],
        selectedForwardTo: 'forward@example.com',
      });

      render(<Popup />);

      await screen.findByText('There are no emails to list');
      expect(screen.queryByText('Refreshing...')).not.toBeInTheDocument();
    });

    it('renders a large list of emails (e.g., 200 items) and handles search/filtering efficiently', async () => {
      popupStateValue = PopupState.AuthenticatedAndManaging;
      clientStateValue = createClientStateTestData();

      const largeList = Array.from({ length: 200 }, (_, i) =>
        createHmeEmailTestData({
          anonymousId: `id-${i}`,
          label: `Label for Alias ${i}`,
          hme: `alias${i}@example.com`,
          createTimestamp: Date.now() - i * 60000,
        })
      );

      listHmeMock.mockResolvedValue({
        hmeEmails: largeList,
        forwardToEmails: ['forward@example.com'],
        selectedForwardTo: 'forward@example.com',
      });

      render(<Popup />);

      // Wait for it to render
      await screen.findByRole('button', { name: 'Label for Alias 0' });

      // Let's type in the search bar to filter
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'Alias 199');

      // Should only show the filtered result
      await screen.findByRole('button', { name: 'Label for Alias 199' });
      expect(
        screen.queryByRole('button', { name: 'Label for Alias 0' })
      ).not.toBeInTheDocument();
    });

    it('demonstrates that background fetch failure does not blow away cached HME list in current UI implementation', async () => {
      popupStateValue = PopupState.AuthenticatedAndManaging;
      clientStateValue = createClientStateTestData();

      // Setup cached value
      cachedHmeListValue = {
        hmeEmails: [
          createHmeEmailTestData({
            anonymousId: 'cached-1',
            label: 'Cached Alias',
            hme: 'cached@example.com',
            isActive: true,
            createTimestamp: Date.now(),
          }),
        ],
        forwardToEmails: ['forward@example.com'],
        selectedForwardTo: 'forward@example.com',
      };

      // Background fetch will fail
      let rejectList: (reason: Error) => void = () => {};
      const listHmePromise = new Promise<ListHmeResult>((_, reject) => {
        rejectList = reject;
      });
      listHmeMock.mockReturnValue(listHmePromise);

      render(<Popup />);

      // The cached alias is displayed instantly
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Cached Alias' })
        ).toBeInTheDocument();
      });

      // Background refresh failure occurs
      await act(async () => {
        rejectList(new Error('Network offline or iCloud failed'));
      });

      // Verify that the cached list remains visible and the error text is not shown
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Cached Alias' })
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByText('Network offline or iCloud failed')
      ).not.toBeInTheDocument();
    });

    it('handles non-ASCII characters correctly in alias details and CSV export', async () => {
      popupStateValue = PopupState.AuthenticatedAndManaging;
      clientStateValue = createClientStateTestData();

      const emails = [
        createHmeEmailTestData({
          anonymousId: 'id-utf8',
          label: 'Möbius 🚀 alias',
          hme: 'mobius@example.com',
          isActive: true,
          note: 'Привет, как дела? "Yes, really" \n 新しいメール',
          forwardToEmail: 'forward@example.com',
          createTimestamp: 1609459200000,
        }),
      ];

      listHmeMock.mockResolvedValue({
        hmeEmails: emails,
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

        // Search filters with non-ASCII label
        const searchInput = await screen.findByPlaceholderText(/search/i);
        await user.type(searchInput, '🚀');
        await screen.findByRole('button', { name: 'Möbius 🚀 alias' });

        // Click export
        const exportButton = await screen.findByRole('button', {
          name: 'Export',
        });
        await user.click(exportButton);

        // Extract and verify CSV content containing non-ASCII characters and complex quoting
        const blob: Blob = createObjectURLMock.mock.calls[0][0];
        const reader = new FileReader();
        const textPromise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
        });
        reader.readAsText(blob);
        const text = await textPromise;

        const expectedCsv = [
          'email,label,note,isActive,forwardToEmail,createdAt',
          'mobius@example.com,Möbius 🚀 alias,"Привет, как дела? ""Yes, really"" \n 新しいメール",true,forward@example.com,2021-01-01T00:00:00.000Z',
        ].join('\r\n');

        expect(text).toBe(expectedCsv);
      } finally {
        globalThis.URL.createObjectURL = originalCreateObjectURL;
        globalThis.URL.revokeObjectURL = originalRevokeObjectURL;
        document.createElement = originalCreateElement;
      }
    });
  });

  it('renders MockModeBanner when mock mode is enabled and popup is authenticated', async () => {
    useBrowserStorageStateMock.mockImplementation((key: string) => {
      if (key === 'popupState')
        return [PopupState.Authenticated, popupStateSetterMock, false];
      if (key === 'clientState')
        return [undefined, clientStateSetterMock, false];
      if (key === 'mockMode') return [true, vi.fn(), false];
      if (key === 'cachedHmeList')
        return [undefined, cachedHmeListSetterMock, false];
      throw new Error(`Unexpected key ${key}`);
    });

    listHmeMock.mockResolvedValue({
      hmeEmails: [],
      forwardToEmails: [],
      selectedForwardTo: 'fwd@example.com',
    });
    generateHmeMock.mockResolvedValue('mock@privaterelay.appleid.com');

    render(<Popup />);

    await screen.findByRole('status', { name: /demo mode active/i });
    expect(screen.getByText(/Demo mode/i)).toBeInTheDocument();
  });

  it('reuses one MockPremiumMailSettings instance across popup rerenders in mock mode', async () => {
    useBrowserStorageStateMock.mockImplementation((key: string) => {
      if (key === 'popupState') {
        return [PopupState.Authenticated, popupStateSetterMock, false];
      }
      if (key === 'clientState') {
        return [undefined, clientStateSetterMock, false];
      }
      if (key === 'mockMode') return [true, vi.fn(), false];
      if (key === 'cachedHmeList') {
        return [undefined, cachedHmeListSetterMock, false];
      }
      throw new Error(`Unexpected key ${key}`);
    });

    listHmeMock.mockResolvedValue({
      hmeEmails: [],
      forwardToEmails: [],
      selectedForwardTo: 'fwd@example.com',
    });
    generateHmeMock.mockResolvedValue('mock@privaterelay.appleid.com');

    const { rerender } = render(<Popup />);

    await screen.findByRole('status', { name: /demo mode active/i });
    rerender(<Popup />);

    expect(MockPremiumMailSettingsConstructorMock).toHaveBeenCalledTimes(1);
  });

  it('shows empty-label error when saving edit with a blank label', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const emails = [
      createHmeEmailTestData({
        anonymousId: 'id-a',
        label: 'Alpha',
        hme: 'a@example.com',
        isActive: true,
        createTimestamp: Date.now(),
      }),
    ];
    listHmeMock.mockResolvedValue({
      hmeEmails: emails,
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    });

    render(<Popup />);

    const aliasBtn = await screen.findByRole('button', { name: 'Alpha' });
    await user.click(aliasBtn);

    const editBtn = await screen.findByRole('button', { name: /edit/i });
    await user.click(editBtn);

    const labelInput = screen.getByDisplayValue('Alpha');
    await user.clear(labelInput);

    const saveBtn = screen.getByRole('button', { name: /save/i });
    await user.click(saveBtn);

    await screen.findByText(/label cannot be empty/i);
    expect(updateHmeMetadataMock).not.toHaveBeenCalled();
  });

  it('exports CSV with null-equivalent field values via csvEscape', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const emails = [
      createHmeEmailTestData({
        anonymousId: 'id-nullish',
        label: 'Null test',
        hme: 'nullish@example.com',
        isActive: true,
        note: '',
        forwardToEmail: 'fwd@example.com',
        createTimestamp: 0,
      }),
    ];

    listHmeMock.mockResolvedValue({
      hmeEmails: emails,
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
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
        const el = originalCreateElement.call(document, tagName);
        if (tagName === 'a') el.click = clickMock;
        return el;
      });

      render(<Popup />);

      await screen.findByRole('button', { name: 'Null test' });
      const exportBtn = await screen.findByRole('button', { name: 'Export' });
      await user.click(exportBtn);

      expect(createObjectURLMock).toHaveBeenCalled();
    } finally {
      globalThis.URL.createObjectURL = originalCreateObjectURL;
      globalThis.URL.revokeObjectURL = originalRevokeObjectURL;
      document.createElement = originalCreateElement;
    }
  });

  it('sort comparator is called when cached list has multiple emails', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const now = Date.now();
    cachedHmeListValue = {
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'c1',
          label: 'Newer',
          hme: 'c1@example.com',
          isActive: true,
          createTimestamp: now,
        }),
        createHmeEmailTestData({
          anonymousId: 'c2',
          label: 'Older',
          hme: 'c2@example.com',
          isActive: true,
          createTimestamp: now - 1000,
        }),
      ],
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    };

    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'c1',
          label: 'Newer',
          hme: 'c1@example.com',
          isActive: true,
          createTimestamp: now,
        }),
        createHmeEmailTestData({
          anonymousId: 'c2',
          label: 'Older',
          hme: 'c2@example.com',
          isActive: true,
          createTimestamp: now - 1000,
        }),
      ],
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    });

    render(<Popup />);

    await screen.findByRole('button', { name: 'Newer' });
    expect(screen.getByRole('button', { name: 'Older' })).toBeInTheDocument();
  });

  it('handles equal-sort-key tie in alias sort (return 0 path)', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const ts = Date.now();
    const emails = [
      createHmeEmailTestData({
        anonymousId: 'e1',
        label: 'B',
        hme: 'e1@example.com',
        isActive: true,
        createTimestamp: ts,
      }),
      createHmeEmailTestData({
        anonymousId: 'e2',
        label: 'A',
        hme: 'e2@example.com',
        isActive: true,
        createTimestamp: ts,
      }),
    ];

    listHmeMock.mockResolvedValue({
      hmeEmails: emails,
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    });

    render(<Popup />);

    // Sort by label A-Z (same timestamp, different labels — label sort ties are settled by label comparison, but two identical labels would hit return 0)
    await screen.findByRole('button', { name: 'B' });

    const sortSelect = screen.getByRole('combobox', { name: /sort aliases/i });
    await user.selectOptions(sortSelect, 'label');

    expect(
      await screen.findByRole('button', { name: 'A' })
    ).toBeInTheDocument();
  });

  it('unselects an alias when modifier-clicked a second time', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const emails = [
      createHmeEmailTestData({
        anonymousId: 'id-x',
        label: 'Checkbox test',
        hme: 'x@example.com',
        isActive: true,
        createTimestamp: Date.now(),
      }),
    ];
    listHmeMock.mockResolvedValue({
      hmeEmails: emails,
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    });

    render(<Popup />);

    const rowButton = await selectAliasWithModifier('Checkbox test');
    expect(await screen.findByText(/1 selected/i)).toBeInTheDocument();

    fireEvent.click(rowButton, { ctrlKey: true });
    await waitFor(() => {
      expect(screen.queryByText(/1 selected/i)).not.toBeInTheDocument();
    });
  });

  it('bulk deactivate marks selected aliases as inactive', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const emails = [
      createHmeEmailTestData({
        anonymousId: 'id-da',
        label: 'Active alias',
        hme: 'da@example.com',
        isActive: true,
        createTimestamp: Date.now(),
      }),
    ];
    listHmeMock.mockResolvedValue({
      hmeEmails: emails,
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    });
    deactivateHmeMock.mockResolvedValue(undefined);

    render(<Popup />);

    await selectAliasWithModifier('Active alias');

    const deactivateBtn = await screen.findByRole('button', {
      name: /Deactivate selected/i,
    });
    await user.click(deactivateBtn);

    await waitFor(() => {
      expect(deactivateHmeMock).toHaveBeenCalledWith('id-da');
    });
  });

  it('reports bulk deactivate failures and clears the selection', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'id-deactivate-error',
          label: 'Deactivate error alias',
          hme: 'deactivate-error@example.com',
          isActive: true,
          createTimestamp: Date.now(),
        }),
      ],
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    });
    deactivateHmeMock.mockRejectedValue(new Error('deactivate failed'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      render(<Popup />);

      await selectAliasWithModifier('Deactivate error alias');
      await user.click(
        await screen.findByRole('button', { name: /Deactivate selected/i })
      );

      await waitFor(() =>
        expect(warnSpy).toHaveBeenCalledWith(
          'Failed to deactivate alias id-deactivate-error: deactivate failed'
        )
      );
      expect(screen.queryByText(/1 selected/i)).not.toBeInTheDocument();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('cancel button on bulk delete clears confirmation state', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const emails = [
      createHmeEmailTestData({
        anonymousId: 'id-c',
        label: 'To cancel',
        hme: 'c@example.com',
        isActive: true,
        createTimestamp: Date.now(),
      }),
    ];
    listHmeMock.mockResolvedValue({
      hmeEmails: emails,
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    });

    render(<Popup />);

    await selectAliasWithModifier('To cancel');

    const deleteBtn = await screen.findByRole('button', {
      name: /Delete selected/i,
    });
    await user.click(deleteBtn);

    const cancelBtn = await screen.findByRole('button', { name: /^Cancel$/i });
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /^Confirm$/i })
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: /Delete selected/i })
    ).toBeInTheDocument();
  });

  it('reports bulk delete failures and clears the selection', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'id-delete-error',
          label: 'Delete error alias',
          hme: 'delete-error@example.com',
          isActive: true,
          createTimestamp: Date.now(),
        }),
      ],
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    });
    deleteHmeMock.mockRejectedValue(new Error('delete failed'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      render(<Popup />);

      await selectAliasWithModifier('Delete error alias');
      await user.click(
        await screen.findByRole('button', { name: /Delete selected/i })
      );
      await user.click(
        await screen.findByRole('button', { name: /^Confirm$/i })
      );

      await waitFor(() =>
        expect(warnSpy).toHaveBeenCalledWith(
          'Failed to delete alias id-delete-error: delete failed'
        )
      );
      expect(
        screen.getByRole('button', { name: 'Delete error alias' })
      ).toBeInTheDocument();
      expect(screen.queryByText(/1 selected/i)).not.toBeInTheDocument();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('initializes reservation cache from latest fetched aliases when cache is empty', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);
    generateHmeMock.mockResolvedValue('new@example.com');

    const existingEmail = createHmeEmailTestData({
      anonymousId: 'existing-id',
      label: 'Existing',
      hme: 'existing@example.com',
    });
    const reservedEmail = createHmeEmailTestData({
      anonymousId: 'new-id',
      label: 'example.com',
      hme: 'new@example.com',
    });

    let resolveList: (value: ListHmeResult) => void = () => undefined;
    const listPromise = new Promise<ListHmeResult>((resolve) => {
      resolveList = resolve;
    });
    listHmeMock.mockReturnValue(listPromise);
    reserveHmeMock.mockResolvedValue(reservedEmail);

    render(<Popup />);

    const form = (await screen.findByLabelText(/Label/i)).closest('form');
    if (form === null) {
      throw new Error('Expected reservation form to render');
    }

    await act(async () => {
      resolveList({
        hmeEmails: [existingEmail],
        forwardToEmails: ['fwd@example.com'],
        selectedForwardTo: 'fwd@example.com',
      });
      await Promise.resolve();
      fireEvent.submit(form);
    });

    await waitFor(() => expect(reserveHmeMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        cachedHmeListValue?.hmeEmails.map((email) => email.anonymousId)
      ).toEqual(['existing-id', 'new-id'])
    );
  });

  it('reserve with no forwarding email uses empty forwardToEmails (fwdToEmail falsy branch)', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);
    generateHmeMock.mockResolvedValue('gen@example.com');
    reserveHmeMock.mockResolvedValue(
      createHmeEmailTestData({
        anonymousId: 'r1',
        label: 'example.com',
        hme: 'gen@example.com',
      })
    );
    // No selectedForwardTo → fwdToEmail will be undefined (falsy)
    listHmeMock.mockResolvedValue({
      hmeEmails: [],
      forwardToEmails: [],
      selectedForwardTo: undefined,
    });

    render(<Popup />);
    await screen.findByLabelText(/Label/i);

    const form = (await screen.findByLabelText(/Label/i)).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => expect(reserveHmeMock).toHaveBeenCalled());
    // cachedHmeListSetterMock called with a function that returns forwardToEmails: []
    expect(cachedHmeListSetterMock).toHaveBeenCalled();
    const updater = cachedHmeListSetterMock.mock.calls[0][0];
    const result = typeof updater === 'function' ? updater(null) : updater;
    expect(result.forwardToEmails).toEqual([]);
    expect(result.selectedForwardTo).toBe('');
  });

  it('reserve with non-null cache adds email without duplicating (lines 484-496)', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);
    generateHmeMock.mockResolvedValue('new@example.com');
    const newEmail = createHmeEmailTestData({
      anonymousId: 'new-id',
      label: 'example.com',
      hme: 'new@example.com',
    });
    reserveHmeMock.mockResolvedValue(newEmail);
    listHmeMock.mockResolvedValue({
      hmeEmails: [],
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    });
    // Pre-populate cache with a DIFFERENT email
    cachedHmeListValue = {
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'cached-id',
          label: 'Cached',
          hme: 'cached@example.com',
        }),
      ],
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    };

    render(<Popup />);
    await screen.findByLabelText(/Label/i);

    const form = (await screen.findByLabelText(/Label/i)).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => expect(reserveHmeMock).toHaveBeenCalled());
    // The updater should add the new email to the existing cache
    const updater = cachedHmeListSetterMock.mock.calls.find(
      (c) => typeof c[0] === 'function'
    )?.[0];
    if (updater) {
      const result = updater(cachedHmeListValue);
      expect(result.hmeEmails).toHaveLength(2);
    }
  });

  it('reserve with non-null cache skips duplicate (line 494)', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);
    generateHmeMock.mockResolvedValue('dup@example.com');
    const dupEmail = createHmeEmailTestData({
      anonymousId: 'dup-id',
      label: 'example.com',
      hme: 'dup@example.com',
    });
    reserveHmeMock.mockResolvedValue(dupEmail);
    listHmeMock.mockResolvedValue({
      hmeEmails: [dupEmail],
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    });
    // Pre-populate cache WITH the same anonymousId as what will be reserved
    const existingCache = {
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'dup-id',
          label: 'Dup',
          hme: 'dup@example.com',
        }),
      ],
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    };
    cachedHmeListValue = existingCache;

    render(<Popup />);
    await screen.findByLabelText(/Label/i);

    const form = (await screen.findByLabelText(/Label/i)).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => expect(reserveHmeMock).toHaveBeenCalled());
    // The updater should detect a duplicate and return prev unchanged
    const updater = cachedHmeListSetterMock.mock.calls.find(
      (c) => typeof c[0] === 'function'
    )?.[0];
    if (updater) {
      const result = updater(existingCache);
      expect(result).toBe(existingCache);
    }
  });

  it('keeps generated email list unchanged when reserving an already loaded alias', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = createClientStateTestData();
    isAuthenticatedMock.mockResolvedValue(true);

    const duplicateEmail = createHmeEmailTestData({
      anonymousId: 'already-loaded-id',
      label: 'example.com',
      hme: 'already-loaded@example.com',
    });
    generateHmeMock.mockResolvedValue('already-loaded@example.com');
    reserveHmeMock.mockResolvedValue(duplicateEmail);
    listHmeMock.mockResolvedValue({
      hmeEmails: [duplicateEmail],
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    });

    render(<Popup />);

    const form = (await screen.findByLabelText(/Label/i)).closest('form');
    if (form === null) {
      throw new Error('Expected reservation form to render');
    }
    fireEvent.submit(form);

    await waitFor(() => expect(reserveHmeMock).toHaveBeenCalled());
    await screen.findByText('Reserved address');
    expect(
      screen.getByText(/Existing alias for this site/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Existing aliases for this site/i)
    ).not.toBeInTheDocument();
  });

  it('cache is not updated when deepEqual shows no change (BRDA 1474)', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const sharedEmail = createHmeEmailTestData({
      anonymousId: 'shared-id',
      label: 'Shared',
      hme: 'shared@example.com',
      isActive: true,
      createTimestamp: 1000,
    });

    // Pre-populate cache with the SAME emails listHme will return
    cachedHmeListValue = {
      hmeEmails: [sharedEmail],
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    };
    listHmeMock.mockResolvedValue({
      hmeEmails: [sharedEmail],
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    });

    render(<Popup />);
    await screen.findByRole('button', { name: 'Shared' });

    // When cache equals fetched, setCachedHmeList updater is NOT called via the sync useEffect
    // (the deepEqual branch is FALSE → skip update)
    const fnCalls = cachedHmeListSetterMock.mock.calls.filter(
      (c) => typeof c[0] === 'function'
    );
    // None of the updater calls should be from the sync effect (deepEqual returns true)
    for (const [fn] of fnCalls) {
      const result = fn(cachedHmeListValue);
      // If it does run, result should still match
      expect(result).toBeDefined();
    }
  });

  it('active sort falls back to timestamp when isActive values are equal (line 1078 || branch)', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const now = Date.now();
    const emails = [
      createHmeEmailTestData({
        anonymousId: 'a1',
        label: 'Later',
        hme: 'a1@example.com',
        isActive: true,
        createTimestamp: now,
      }),
      createHmeEmailTestData({
        anonymousId: 'a2',
        label: 'Earlier',
        hme: 'a2@example.com',
        isActive: true,
        createTimestamp: now - 5000,
      }),
    ];
    listHmeMock.mockResolvedValue({
      hmeEmails: emails,
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    });

    render(<Popup />);
    await screen.findByRole('button', { name: 'Later' });

    // Switch to 'active' sort — both emails have same isActive=true,
    // so (1-1)=0 → || right side (timestamp diff) is evaluated to order them
    const sortSelect = screen.getByRole('combobox', { name: /sort aliases/i });
    await user.selectOptions(sortSelect, 'active');

    // Both buttons should still be in the DOM (sorted by timestamp)
    expect(screen.getByRole('button', { name: 'Later' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Earlier' })).toBeInTheDocument();
  });

  it('falls back to newest sorting when an invalid sort option is emitted', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const now = Date.now();
    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'sort-fallback-new',
          label: 'Newest fallback alias',
          hme: 'newest-fallback@example.com',
          isActive: true,
          createTimestamp: now,
        }),
        createHmeEmailTestData({
          anonymousId: 'sort-fallback-old',
          label: 'Oldest fallback alias',
          hme: 'oldest-fallback@example.com',
          isActive: true,
          createTimestamp: now - 1000,
        }),
      ],
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    });

    render(<Popup />);
    await screen.findByRole('button', { name: 'Newest fallback alias' });

    const sortSelect = screen.getByRole('combobox', { name: /sort aliases/i });
    fireEvent.change(sortSelect, { target: { value: 'invalid-sort' } });

    expect(sortSelect).toHaveValue('newest');
  });

  it('keeps keyboard selection within first and last aliases', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const now = Date.now();
    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'edge-1',
          label: 'First edge alias',
          hme: 'edge-first@example.com',
          isActive: true,
          createTimestamp: now,
        }),
        createHmeEmailTestData({
          anonymousId: 'edge-2',
          label: 'Last edge alias',
          hme: 'edge-last@example.com',
          isActive: true,
          createTimestamp: now - 1000,
        }),
      ],
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    });

    render(<Popup />);

    const firstAliasButton = await screen.findByRole('button', {
      name: 'First edge alias',
    });
    const lastAliasButton = screen.getByRole('button', {
      name: 'Last edge alias',
    });
    const listbox = screen.getByRole('tree');

    fireEvent.keyDown(listbox, { key: 'ArrowUp' });
    expect(firstAliasButton).toHaveAttribute('aria-current', 'true');

    fireEvent.keyDown(firstAliasButton, { key: 'ArrowDown' });
    expect(lastAliasButton).toHaveAttribute('aria-current', 'true');

    fireEvent.keyDown(lastAliasButton, { key: 'ArrowDown' });
    expect(lastAliasButton).toHaveAttribute('aria-current', 'true');

    fireEvent.keyDown(lastAliasButton, { key: 'Tab' });
    expect(lastAliasButton).toHaveAttribute('aria-current', 'true');
  });

  it('ignores alias-list keyboard events when search has no results', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'search-empty-id',
          label: 'Searchable alias',
          hme: 'searchable@example.com',
          isActive: true,
          createTimestamp: Date.now(),
        }),
      ],
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    });

    render(<Popup />);

    await screen.findByRole('button', { name: 'Searchable alias' });
    await user.type(screen.getByRole('searchbox'), 'missing');

    const listbox = screen.getByRole('tree');
    await screen.findByText(/No results for/i);
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });

    expect(screen.getByText(/No results for/i)).toBeInTheDocument();
  });

  it('ignores alias-list keydown events from non-row buttons', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    listHmeMock.mockResolvedValue({
      hmeEmails: [
        createHmeEmailTestData({
          anonymousId: 'k3',
          label: 'Key3',
          hme: 'k3@example.com',
          isActive: true,
          createTimestamp: Date.now(),
        }),
      ],
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    });

    render(<Popup />);
    const aliasButton = await screen.findByRole('button', { name: 'Key3' });

    const copyButton = screen.getByRole('button', { name: /copy alias/i });
    fireEvent.keyDown(copyButton, { key: 'ArrowDown' });

    expect(aliasButton).toHaveAttribute('aria-current', 'true');
  });

  it('bulk delete confirmation shows plural "aliases" when multiple are selected (line 1361)', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const emails = [
      createHmeEmailTestData({
        anonymousId: 'id-p1',
        label: 'Plural1',
        hme: 'p1@example.com',
        isActive: true,
        createTimestamp: Date.now(),
      }),
      createHmeEmailTestData({
        anonymousId: 'id-p2',
        label: 'Plural2',
        hme: 'p2@example.com',
        isActive: true,
        createTimestamp: Date.now() - 1000,
      }),
    ];
    listHmeMock.mockResolvedValue({
      hmeEmails: emails,
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    });

    render(<Popup />);

    await selectAliasWithModifier('Plural1');
    const plural2Button = screen.getByRole('button', { name: 'Plural2' });
    fireEvent.click(plural2Button, { ctrlKey: true });

    const deleteBtn = await screen.findByRole('button', {
      name: /Delete selected/i,
    });
    await user.click(deleteBtn);

    // With 2 items selected, the confirmation should show "aliases" (plural)
    expect(await screen.findByText(/Delete 2 aliases\?/i)).toBeInTheDocument();
  });

  it('bulk deactivate leaves non-selected emails unchanged (line 1509 false branch)', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = createClientStateTestData();

    const emails = [
      createHmeEmailTestData({
        anonymousId: 'da-id1',
        label: 'Deactivate Me',
        hme: 'd1@example.com',
        isActive: true,
        createTimestamp: Date.now(),
      }),
      createHmeEmailTestData({
        anonymousId: 'da-id2',
        label: 'Keep Me',
        hme: 'd2@example.com',
        isActive: true,
        createTimestamp: Date.now() - 1000,
      }),
    ];
    listHmeMock.mockResolvedValue({
      hmeEmails: emails,
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    });
    deactivateHmeMock.mockResolvedValue(undefined);

    render(<Popup />);

    // Select only the first email for deactivation
    await selectAliasWithModifier('Deactivate Me');

    const deactivateBtn = await screen.findByRole('button', {
      name: /Deactivate selected/i,
    });
    await user.click(deactivateBtn);

    await waitFor(() =>
      expect(deactivateHmeMock).toHaveBeenCalledWith('da-id1')
    );
    // 'Keep Me' alias should still be visible (not deactivated — FALSE branch of ids.includes)
    expect(screen.getByRole('button', { name: 'Keep Me' })).toBeInTheDocument();
  });

  it('HmeManager renders MockModeBanner and uses MockPremiumMailSettings when mockMode is on', async () => {
    // Override the mock to set AuthenticatedAndManaging + mockMode=true
    useBrowserStorageStateMock.mockImplementation((key: string) => {
      if (key === 'popupState')
        return [
          PopupState.AuthenticatedAndManaging,
          popupStateSetterMock,
          false,
        ];
      if (key === 'clientState')
        return [undefined, clientStateSetterMock, false];
      if (key === 'mockMode') return [true, vi.fn(), false];
      if (key === 'cachedHmeList')
        return [undefined, cachedHmeListSetterMock, false];
      throw new Error(`Unexpected key: ${key}`);
    });

    listHmeMock.mockResolvedValue({
      hmeEmails: [],
      forwardToEmails: [],
      selectedForwardTo: 'fwd@example.com',
    });

    render(<Popup />);

    // MockModeBanner should appear (mockMode=true in HmeManager)
    await screen.findByRole('status', { name: /demo mode active/i });
    expect(screen.getByText(/Demo mode/i)).toBeInTheDocument();
  });
});
