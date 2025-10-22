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

  const PremiumMailSettingsConstructorMock = vi.fn((client: unknown) => ({
    client,
    listHme: listHmeMock,
    generateHme: generateHmeMock,
    reserveHme: reserveHmeMock,
    updateHmeMetadata: updateHmeMetadataMock,
    deactivateHme: deactivateHmeMock,
    reactivateHme: reactivateHmeMock,
    deleteHme: deleteHmeMock,
    updateForwardToHme: vi.fn(),
  }));

  return {
    useBrowserStorageStateMock,
    contextMenuUpdateMock,
    runtimeGetUrlMock,
    tabsQueryMock,
    setBrowserStorageValueMock,
    popupStateSetterMock,
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
  const originalClipboard = navigator.clipboard;

  beforeAll(() => {
    Object.defineProperty(window.navigator, 'clipboard', {
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
      delete (window.navigator as { clipboard?: Clipboard }).clipboard;
    } else {
      Object.defineProperty(window.navigator, 'clipboard', {
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
    sendMessageToTabMock.mockReset();
    updateHmeMetadataMock.mockReset();
    deactivateHmeMock.mockReset();
    reactivateHmeMock.mockReset();
    deleteHmeMock.mockReset();
    clipboardWriteMock.mockReset();
    clipboardWriteMock.mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
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
        return [clientStateValue, vi.fn(), clientStateLoading];
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
});
