import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import Popup from '../src/pages/Popup/Popup';
import { PopupState } from '../src/pages/Popup/stateMachine';
import { CONTEXT_MENU_ITEM_ID } from '../src/pages/Background/constants';

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
  };
});

vi.mock('../src/hooks', () => ({
  useBrowserStorageState: useBrowserStorageStateMock,
}));

vi.mock('../src/storage', () => ({
  setBrowserStorageValue: setBrowserStorageValueMock,
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

  let popupStateValue: PopupState;
  let clientStateValue:
    | {
        setupUrl: string;
        webservices: Record<string, { url: string; status: string }>;
      }
    | undefined;
  let popupStateLoading = false;
  let clientStateLoading = false;
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
    reserveHmeMock.mockResolvedValue({
      anonymousId: 'anon',
      note: 'note',
      label: 'label',
      hme: 'generated@example.com',
      forwardToEmail: 'forward@example.com',
      origin: 'ON_DEMAND',
      isActive: true,
      domain: 'domain',
      createTimestamp: Date.now(),
      recipientMailId: 'recipient',
    });
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
    clientStateValue = {
      setupUrl: 'https://setup.example.com',
      webservices: {
        premiummailsettings: {
          url: 'https://service.example.com',
          status: 'active',
        },
      },
    };
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
    clientStateValue = {
      setupUrl: 'https://setup.example.com',
      webservices: {
        premiummailsettings: {
          url: 'https://service.example.com',
          status: 'active',
        },
      },
    };

    generateHmeMock.mockReset();
    generateHmeMock.mockResolvedValueOnce('initial@example.com');
    generateHmeMock.mockResolvedValueOnce('refreshed@example.com');
    reserveHmeMock.mockReset();
    reserveHmeMock.mockResolvedValueOnce({
      anonymousId: 'anon',
      note: 'Remember me',
      label: 'My Label',
      hme: 'reserved@example.com',
      forwardToEmail: 'forward@example.com',
      origin: 'ON_DEMAND',
      isActive: true,
      domain: 'domain',
      createTimestamp: Date.now(),
      recipientMailId: 'recipient',
    });
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

  // Exercises manager view: search, activate/deactivate, delete, reactivate, and sign-out side effects.
  it('manages existing aliases with search, activation toggles, deletion, and sign-out', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = {
      setupUrl: 'https://setup.example.com',
      webservices: {
        premiummailsettings: {
          url: 'https://service.example.com',
          status: 'active',
        },
      },
    };

    const now = Date.now();
    const activeAlias = {
      anonymousId: 'active',
      note: '',
      label: 'Alpha alias',
      hme: 'alpha@example.com',
      forwardToEmail: 'forward@example.com',
      origin: 'ON_DEMAND' as const,
      isActive: true,
      domain: 'domain',
      createTimestamp: now,
      recipientMailId: 'recipient',
    };
    const betaAlias = {
      anonymousId: 'beta',
      note: 'Beta note',
      label: 'Beta alias',
      hme: 'beta@example.com',
      forwardToEmail: 'forward@example.com',
      origin: 'ON_DEMAND' as const,
      isActive: false,
      domain: 'domain',
      createTimestamp: now - 1000,
      recipientMailId: 'recipient',
    };
    const gammaAlias = {
      anonymousId: 'gamma',
      note: '',
      label: 'Gamma alias',
      hme: 'gamma@example.com',
      forwardToEmail: 'forward@example.com',
      origin: 'ON_DEMAND' as const,
      isActive: false,
      domain: 'domain',
      createTimestamp: now - 2000,
      recipientMailId: 'recipient',
    };

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
    expect(setBrowserStorageValueMock).not.toHaveBeenCalled();
    expect(contextMenuUpdateMock).toHaveBeenCalledWith(
      CONTEXT_MENU_ITEM_ID,
      expect.objectContaining({ enabled: false })
    );
    expect(popupStateSetterMock).toHaveBeenCalledWith(PopupState.SignedOut);
  });

  // syncClientAuthState success path should promote SignedOut to Authenticated.
  it('promotes signed-out state when stored session is still authenticated', async () => {
    popupStateValue = PopupState.SignedOut;
    clientStateValue = {
      setupUrl: 'https://setup.example.com',
      webservices: {},
    };
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
  });

  // Error path: listHme rejection should surface the error UI.
  it('renders an error state when alias fetching fails in manager view', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = {
      setupUrl: 'https://setup.example.com',
      webservices: {
        premiummailsettings: {
          url: 'https://service.example.com',
          status: 'active',
        },
      },
    };

    listHmeMock.mockRejectedValue(new Error('loading failed'));

    render(<Popup />);

    await waitFor(() =>
      expect(screen.getByText(/loading failed/i)).toBeInTheDocument()
    );
  });

  // Empty state branch when no aliases are returned.
  it('renders an empty state when no aliases are returned', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = {
      setupUrl: 'https://setup.example.com',
      webservices: {
        premiummailsettings: {
          url: 'https://service.example.com',
          status: 'active',
        },
      },
    };

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

  // constructClient guard: missing clientState should throw.
  it('throws when attempting to construct a client without persisted state', () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = undefined;

    expect(() => render(<Popup />)).toThrow(
      /Cannot construct client when client state is undefined/i
    );
  });

  // transitionToNextStateElement default branch should be unreachable.
  it('throws on an unknown popup state', () => {
    popupStateValue = 99 as PopupState;
    clientStateValue = undefined;

    expect(() => render(<Popup />)).toThrow(/Unhandled PopupState case/i);
  });

  it('handles errors when updating the context menu on sign-out', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = {
      setupUrl: 'https://setup.example.com',
      webservices: {
        premiummailsettings: {
          url: 'https://service.example.com',
          status: 'active',
        },
      },
    };
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
    clientStateValue = {
      setupUrl: 'https://setup.example.com',
      webservices: {
        premiummailsettings: {
          url: 'https://service.example.com',
          status: 'active',
        },
      },
    };
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
    clientStateValue = {
      setupUrl: 'https://setup.example.com',
      webservices: {
        premiummailsettings: {
          url: 'https://service.example.com',
          status: 'active',
        },
      },
    };
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
    clientStateValue = {
      setupUrl: 'https://setup.example.com',
      webservices: {
        premiummailsettings: {
          url: 'https://service.example.com',
          status: 'active',
        },
      },
    };

    const now = Date.now();
    listHmeMock.mockResolvedValue({
      hmeEmails: [
        {
          anonymousId: 'active',
          note: '',
          label: 'Active alias',
          hme: 'active@example.com',
          forwardToEmail: 'forward@example.com',
          origin: 'ON_DEMAND',
          isActive: true,
          domain: 'domain',
          createTimestamp: now,
          recipientMailId: 'recipient',
        },
        {
          anonymousId: 'inactive',
          note: '',
          label: 'Inactive alias',
          hme: 'inactive@example.com',
          forwardToEmail: 'forward@example.com',
          origin: 'ON_DEMAND',
          isActive: false,
          domain: 'domain',
          createTimestamp: now - 1000,
          recipientMailId: 'recipient',
        },
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
    await waitFor(() =>
      expect(screen.getByText(/delete failed/i)).toBeInTheDocument()
    );
  });

  it('handles errors when fetching forward-to email list', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = {
      setupUrl: 'https://setup.example.com',
      webservices: {
        premiummailsettings: {
          url: 'https://service.example.com',
          status: 'active',
        },
      },
    };
    isAuthenticatedMock.mockResolvedValue(true);
    listHmeMock.mockRejectedValue(new Error('list failed'));

    render(<Popup />);

    await waitFor(() =>
      expect(screen.getByText(/list failed/i)).toBeInTheDocument()
    );
  });

  it('handles errors when generating new email on mount', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = {
      setupUrl: 'https://setup.example.com',
      webservices: {
        premiummailsettings: {
          url: 'https://service.example.com',
          status: 'active',
        },
      },
    };
    isAuthenticatedMock.mockResolvedValue(true);
    generateHmeMock.mockRejectedValue(new Error('generate failed'));

    render(<Popup />);

    await waitFor(() =>
      expect(screen.getByText(/generate failed/i)).toBeInTheDocument()
    );
  });

  it('handles errors when manually refreshing email', async () => {
    popupStateValue = PopupState.Authenticated;
    clientStateValue = {
      setupUrl: 'https://setup.example.com',
      webservices: {
        premiummailsettings: {
          url: 'https://service.example.com',
          status: 'active',
        },
      },
    };
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
    clientStateValue = {
      setupUrl: 'https://setup.example.com',
      webservices: {
        premiummailsettings: {
          url: 'https://service.example.com',
          status: 'active',
        },
      },
    };

    const now = Date.now();
    listHmeMock.mockResolvedValue({
      hmeEmails: [
        {
          anonymousId: 'first',
          note: '',
          label: 'Apple service',
          hme: 'first@example.com',
          forwardToEmail: 'forward@example.com',
          origin: 'ON_DEMAND',
          isActive: true,
          domain: 'domain',
          createTimestamp: now,
          recipientMailId: 'recipient',
        },
        {
          anonymousId: 'second',
          note: '',
          label: 'Banana service',
          hme: 'second@example.com',
          forwardToEmail: 'forward@example.com',
          origin: 'ON_DEMAND',
          isActive: true,
          domain: 'domain',
          createTimestamp: now - 1000,
          recipientMailId: 'recipient',
        },
        {
          anonymousId: 'third',
          note: '',
          label: 'Cherry service',
          hme: 'third@example.com',
          forwardToEmail: 'forward@example.com',
          origin: 'ON_DEMAND',
          isActive: true,
          domain: 'domain',
          createTimestamp: now - 2000,
          recipientMailId: 'recipient',
        },
      ],
      forwardToEmails: [],
      selectedForwardTo: 'forward@example.com',
    });

    render(<Popup />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Apple service/i })).toBeInTheDocument()
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
      const firstButton = screen.getByRole('button', { name: /Apple service/i });
      expect(firstButton).toBeInTheDocument();
      // Since only one item is visible, selectedIndex should be 0
    });
  });

  it('can click the generate footer button', async () => {
    popupStateValue = PopupState.AuthenticatedAndManaging;
    clientStateValue = {
      setupUrl: 'https://setup.example.com',
      webservices: {
        premiummailsettings: {
          url: 'https://service.example.com',
          status: 'active',
        },
      },
    };

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
});
