import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Options from '../src/pages/Options/Options';
import { DEFAULT_STORE } from '../src/storage';

const {
  storageStateMocks,
  useBrowserStorageStateSpy,
  ICloudClientConstructorMock,
  isAuthenticatedMock,
  PremiumMailSettingsMock,
  listHmeMock,
  updateForwardToHmeMock,
  webExtensionPolyfillMock,
} = vi.hoisted(() => {
  const React = require('react') as typeof import('react');
  const store: Record<
    string,
    {
      state?: unknown;
      isLoading?: boolean;
      spy?: ReturnType<typeof vi.fn>;
    }
  > = {};
  const useBrowserStorageStateSpy = vi.fn(
    (key: string, initialValue: unknown) => {
      const entry = store[key] ?? (store[key] = {});
      const [state, setState] = React.useState(entry.state ?? initialValue);
      entry.state = state;

      const spy = entry.spy ?? vi.fn();
      entry.spy = spy;
      const isLoading = entry.isLoading ?? false;

      const setStateWithSpy = React.useMemo(
        () =>
          (value: unknown) => {
            setState((prev) => {
              const nextValue =
                typeof value === 'function' ? value(prev) : value;
              spy(nextValue);
              return nextValue;
            });
          },
        [setState, spy]
      );

      return [state, setStateWithSpy, isLoading] as [
        unknown,
        (value: unknown) => void,
        boolean,
      ];
    }
  );
  const isAuthenticatedMock = vi.fn();
  const listHmeMock = vi.fn();
  const updateForwardToHmeMock = vi.fn();
  const ICloudClientConstructorMock = vi
    .fn<[], { isAuthenticated: typeof isAuthenticatedMock }>
    (() => ({
      isAuthenticated: isAuthenticatedMock,
    }));
  const PremiumMailSettingsMock = vi.fn(() => ({
    listHme: listHmeMock,
    updateForwardToHme: updateForwardToHmeMock,
  }));
  const webExtensionPolyfillMock = {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
      },
    },
  };

  return {
    storageStateMocks: store,
    useBrowserStorageStateSpy,
    ICloudClientConstructorMock,
    isAuthenticatedMock,
    PremiumMailSettingsMock,
    listHmeMock,
    updateForwardToHmeMock,
    webExtensionPolyfillMock,
  };
});

vi.mock('../src/hooks', () => ({
  useBrowserStorageState: useBrowserStorageStateSpy,
}));

vi.mock('../src/iCloudClient', () => ({
  default: ICloudClientConstructorMock,
  PremiumMailSettings: PremiumMailSettingsMock,
}));

vi.mock('webextension-polyfill', () => webExtensionPolyfillMock);

vi.mock('../src/pages/Options/Options.css', () => ({}), { virtual: true });

describe('Options page UI', () => {
  beforeEach(() => {
    Object.keys(storageStateMocks).forEach((key) => {
      delete storageStateMocks[key];
    });
    useBrowserStorageStateSpy.mockClear();
    ICloudClientConstructorMock.mockClear();
    PremiumMailSettingsMock.mockClear();
    isAuthenticatedMock.mockReset();
    listHmeMock.mockReset();
    updateForwardToHmeMock.mockReset();
    webExtensionPolyfillMock.storage.local.get.mockReset();
    webExtensionPolyfillMock.storage.local.set.mockReset();
    webExtensionPolyfillMock.storage.local.remove.mockReset();
  });

  it('surfaces a sign-in prompt when no client state is available', async () => {
    storageStateMocks.iCloudHmeOptions = {
      state: DEFAULT_STORE.iCloudHmeOptions,
      isLoading: false,
    };
    storageStateMocks.clientState = {
      state: undefined,
      spy: vi.fn(),
      isLoading: false,
    };

    render(<Options />);

    await waitFor(() =>
      expect(
        screen.getByText(
          /To select a new Forward-To address, you first need to sign-in/i
        )
      ).toBeInTheDocument()
    );

    expect(ICloudClientConstructorMock).not.toHaveBeenCalled();
    expect(listHmeMock).not.toHaveBeenCalled();
  });

  it('lists available forwarding targets and updates options when toggled', async () => {
    const initialOptions = structuredClone(DEFAULT_STORE.iCloudHmeOptions);
    storageStateMocks.iCloudHmeOptions = {
      state: initialOptions,
      isLoading: false,
    };
    storageStateMocks.clientState = {
      state: {
        setupUrl: 'https://setup.example.com',
        webservices: {
          premiummailsettings: {
            url: 'https://service.example.com',
            status: 'active',
          },
        },
      },
      spy: vi.fn(),
      isLoading: false,
    };

    isAuthenticatedMock.mockResolvedValue(true);
    listHmeMock.mockResolvedValue({
      forwardToEmails: ['alias-one@example.com', 'alias-two@example.com'],
      selectedForwardTo: 'alias-one@example.com',
    });
    updateForwardToHmeMock.mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<Options />);

    const firstAliasRadio = await screen.findByLabelText(
      'alias-one@example.com'
    );
    const secondAliasRadio = screen.getByLabelText('alias-two@example.com');

    expect(firstAliasRadio).toBeChecked();
    expect(secondAliasRadio).not.toBeChecked();

    await user.click(secondAliasRadio);
    await waitFor(() => expect(secondAliasRadio).toBeChecked());
    await user.click(
      screen.getByRole('button', { name: /update forwarding/i })
    );

    await waitFor(() =>
      expect(updateForwardToHmeMock).toHaveBeenCalledWith(
        'alias-two@example.com'
      )
    );

    const contextMenuCheckbox = screen.getByLabelText('Context Menu');
    expect(contextMenuCheckbox).toBeChecked();
    await user.click(contextMenuCheckbox);
    await waitFor(() => expect(contextMenuCheckbox).not.toBeChecked());

    await waitFor(() =>
      expect(storageStateMocks.iCloudHmeOptions?.state).toEqual({
        autofill: { button: true, contextMenu: false },
      })
    );
  });
});
