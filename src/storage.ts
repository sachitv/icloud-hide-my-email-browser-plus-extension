import browser from 'webextension-polyfill';
import ICloudClient, { DEFAULT_RESERVATION_NOTE } from './iCloudClient';
import { PopupState } from './pages/Popup/stateMachine';

export type Autofill = {
  button: boolean;
  contextMenu: boolean;
};

export type Options = {
  autofill: Autofill;
  defaults: {
    reservationNote: string;
  };
};

export type Store = {
  popupState: PopupState;
  iCloudHmeOptions: Options; // TODO: rename key to options
  clientState?: {
    setupUrl: ConstructorParameters<typeof ICloudClient>[0];
    webservices: ConstructorParameters<typeof ICloudClient>[1];
  };
};

export const DEFAULT_STORE = {
  popupState: PopupState.SignedOut,
  iCloudHmeOptions: {
    autofill: {
      button: true,
      contextMenu: true,
    },
    defaults: {
      reservationNote: DEFAULT_RESERVATION_NOTE,
    },
  },
  clientState: undefined,
};

export async function getBrowserStorageValue<K extends keyof Store>(
  key: K
): Promise<Store[K] | undefined> {
  const store: Partial<Store> = await browser.storage.local.get(key);
  return store[key];
}

export async function setBrowserStorageValue<K extends keyof Store>(
  key: K,
  value: Store[K]
): Promise<void> {
  if (value === undefined) {
    await browser.storage.local.remove(key);
  } else {
    await browser.storage.local.set({ [key]: value });
  }
}
