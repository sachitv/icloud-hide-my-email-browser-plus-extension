import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PopupState } from '../src/pages/Popup/stateMachine';
import {
  getBrowserStorageValue,
  setBrowserStorageValue,
  DEFAULT_STORE,
} from '../src/storage';

const { browserStorageMocks } = vi.hoisted(() => ({
  browserStorageMocks: {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
      },
    },
  },
}));

vi.mock('webextension-polyfill', () => ({
  __esModule: true,
  default: browserStorageMocks,
}));

describe('storage helpers', () => {
  beforeEach(() => {
    browserStorageMocks.storage.local.get.mockReset();
    browserStorageMocks.storage.local.set.mockReset();
    browserStorageMocks.storage.local.remove.mockReset();
  });

  // Happy path for reading a stored value.
  it('returns the stored value for the requested key', async () => {
    const storedValue = PopupState.Authenticated;
    browserStorageMocks.storage.local.get.mockResolvedValue({
      popupState: storedValue,
    });

    await expect(getBrowserStorageValue('popupState')).resolves.toBe(
      storedValue
    );
    expect(browserStorageMocks.storage.local.get).toHaveBeenCalledWith(
      'popupState'
    );
  });

  // Ensures missing keys resolve to undefined.
  it('falls back to undefined when the key is not present', async () => {
    browserStorageMocks.storage.local.get.mockResolvedValue({});

    await expect(
      getBrowserStorageValue('clientState')
    ).resolves.toBeUndefined();
  });

  // Validates that defined values route through storage.set.
  it('persists new values with set when provided', async () => {
    const newOptions = {
      ...DEFAULT_STORE.iCloudHmeOptions,
      autofill: { button: false, contextMenu: true },
    };

    await setBrowserStorageValue('iCloudHmeOptions', newOptions);

    expect(browserStorageMocks.storage.local.set).toHaveBeenCalledWith({
      iCloudHmeOptions: newOptions,
    });
    expect(browserStorageMocks.storage.local.remove).not.toHaveBeenCalled();
  });

  // Confirms undefined values trigger storage.remove.
  it('removes the value when set with undefined', async () => {
    await setBrowserStorageValue('clientState', undefined);

    expect(browserStorageMocks.storage.local.remove).toHaveBeenCalledWith(
      'clientState'
    );
    expect(browserStorageMocks.storage.local.set).not.toHaveBeenCalled();
  });

  it('reads and writes cachedHmeList correctly', async () => {
    const mockHmeList = {
      hmeEmails: [
        {
          anonymousId: 'id1',
          hme: 'test@example.com',
          label: 'Test',
          note: 'Note',
          isActive: true,
          forwardToEmail: 'fwd@example.com',
          createTimestamp: 123456789,
        },
      ],
      forwardToEmails: ['fwd@example.com'],
      selectedForwardTo: 'fwd@example.com',
    };
    browserStorageMocks.storage.local.get.mockResolvedValue({
      cachedHmeList: mockHmeList,
    });

    await expect(getBrowserStorageValue('cachedHmeList')).resolves.toEqual(
      mockHmeList
    );

    await setBrowserStorageValue('cachedHmeList', mockHmeList);
    expect(browserStorageMocks.storage.local.set).toHaveBeenCalledWith({
      cachedHmeList: mockHmeList,
    });
  });
});
