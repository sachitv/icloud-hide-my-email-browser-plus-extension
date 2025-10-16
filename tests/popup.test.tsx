import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Popup from '../src/pages/Popup/Popup';
import { PopupState } from '../src/pages/Popup/stateMachine';
import { CONTEXT_MENU_ITEM_ID } from '../src/pages/Background/constants';
import { DEFAULT_STORE } from '../src/storage';

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
  PremiumMailSettingsConstructorMock,
  ICloudClientMock,
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
    updateHmeMetadata: vi.fn(),
    deactivateHme: vi.fn(),
    reactivateHme: vi.fn(),
    deleteHme: vi.fn(),
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
    PremiumMailSettingsConstructorMock,
    ICloudClientMock,
  };
});

vi.mock('../src/hooks', () => ({
  useBrowserStorageState: useBrowserStorageStateMock,
}));

vi.mock('../src/storage', async () => {
  const actual = await vi.importActual<typeof import('../src/storage')>(
    '../src/storage'
  );

  return {
    ...actual,
    setBrowserStorageValue: setBrowserStorageValueMock,
  };
});

vi.mock('../src/messages', () => ({
  MessageType: { Autofill: 'Autofill' },
  sendMessageToTab: sendMessageToTabMock,
}));

vi.mock('../src/iCloudClient', async () => {
  const actual = await vi.importActual<typeof import('../src/iCloudClient')>(
    '../src/iCloudClient'
  );

  return {
    ...actual,
    default: ICloudClientMock,
    PremiumMailSettings: PremiumMailSettingsConstructorMock,
  };
});

vi.mock('webextension-polyfill', () => ({
  default: {
    contextMenus: { update: contextMenuUpdateMock },
    runtime: { getURL: runtimeGetUrlMock, id: 'test-extension' },
    tabs: { query: tabsQueryMock },
  },
}));

describe('Popup UI', () => {
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

      if (key === 'iCloudHmeOptions') {
        return [DEFAULT_STORE.iCloudHmeOptions, vi.fn(), false];
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
});
