import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PopupState } from '../src/pages/Popup/stateMachine';
import { useBrowserStorageState } from '../src/hooks';

const {
  browserStorageMocks,
  getBrowserStorageValueMock,
  setBrowserStorageValueMock,
} = vi.hoisted(() => ({
  browserStorageMocks: {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
      },
    },
  },
  getBrowserStorageValueMock: vi.fn(),
  setBrowserStorageValueMock: vi.fn(),
}));

vi.mock('webextension-polyfill', () => ({
  __esModule: true,
  default: browserStorageMocks,
}));

vi.mock('../src/storage', async () => {
  const actual = await vi.importActual<typeof import('../src/storage')>(
    '../src/storage'
  );
  return {
    ...actual,
    getBrowserStorageValue: getBrowserStorageValueMock,
    setBrowserStorageValue: setBrowserStorageValueMock,
  };
});

describe('useBrowserStorageState', () => {
  beforeEach(() => {
    getBrowserStorageValueMock.mockReset();
    setBrowserStorageValueMock.mockReset();
  });

  const renderHookProbe = async () => {
    let latestValue: PopupState | undefined;
    let latestIsLoading: boolean | undefined;
    let latestSetter: React.Dispatch<React.SetStateAction<PopupState>> =
      () => undefined;

    const Probe = () => {
      const [value, setValue, isLoading] = useBrowserStorageState(
        'popupState',
        PopupState.SignedOut
      );
      latestValue = value;
      latestSetter = setValue;
      latestIsLoading = isLoading;
      return null;
    };

    render(<Probe />);

    return {
      get value() {
        return latestValue;
      },
      get isLoading() {
        return latestIsLoading;
      },
      get setter() {
        return latestSetter;
      },
    };
  };

  // Validates initial hydration path and loading state transitions.
  it('hydrates state from storage and toggles loading flag', async () => {
    getBrowserStorageValueMock.mockResolvedValue(PopupState.Authenticated);

    const probe = await renderHookProbe();

    expect(probe.value).toBe(PopupState.SignedOut);
    expect(probe.isLoading).toBe(true);
    await waitFor(() => expect(probe.isLoading).toBe(false));
    expect(probe.value).toBe(PopupState.Authenticated);
    expect(getBrowserStorageValueMock).toHaveBeenCalledWith('popupState');
  });

  // Ensures both direct values and functional updates persist to storage.
  it('persists state updates and supports functional setters', async () => {
    getBrowserStorageValueMock.mockResolvedValue(undefined);
    const probe = await renderHookProbe();

    await waitFor(() => expect(probe.isLoading).toBe(false));

    await act(async () => {
      probe.setter(PopupState.Authenticated);
    });

    expect(setBrowserStorageValueMock).toHaveBeenCalledWith(
      'popupState',
      PopupState.Authenticated
    );
    expect(probe.value).toBe(PopupState.Authenticated);

    await act(async () => {
      probe.setter((prev) =>
        prev === PopupState.Authenticated
          ? PopupState.AuthenticatedAndManaging
          : prev
      );
    });

    expect(setBrowserStorageValueMock).toHaveBeenLastCalledWith(
      'popupState',
      PopupState.AuthenticatedAndManaging
    );
    expect(probe.value).toBe(PopupState.AuthenticatedAndManaging);
  });

  // Guards against unnecessary writes when the stored snapshot matches.
  it('avoids state updates when the stored value matches current state', async () => {
    getBrowserStorageValueMock.mockResolvedValue(PopupState.SignedOut);

    const probe = await renderHookProbe();

    await waitFor(() => expect(probe.isLoading).toBe(false));

    expect(probe.value).toBe(PopupState.SignedOut);
    expect(setBrowserStorageValueMock).not.toHaveBeenCalled();
  });
});
