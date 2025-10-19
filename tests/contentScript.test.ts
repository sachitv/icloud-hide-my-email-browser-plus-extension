import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  vi,
  type Mock,
} from 'vitest';
import { MessageType } from '../src/messages';

const arrayBufferDescriptor = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  'resizable'
);
if (arrayBufferDescriptor?.get === undefined) {
  Object.defineProperty(ArrayBuffer.prototype, 'resizable', {
    configurable: true,
    get() {
      return false;
    },
  });
}

if (typeof SharedArrayBuffer !== 'undefined') {
  const sharedArrayBufferDescriptor = Object.getOwnPropertyDescriptor(
    SharedArrayBuffer.prototype,
    'growable'
  );
  if (sharedArrayBufferDescriptor?.get === undefined) {
    Object.defineProperty(SharedArrayBuffer.prototype, 'growable', {
      configurable: true,
      get() {
        return false;
      },
    });
  }
}

const {
  runtimeSendMessageMock,
  runtimeOnMessageAddListenerMock,
  storageLocalGetMock,
} = vi.hoisted(() => {
  const sendMessage = vi.fn<[], Promise<void>>().mockResolvedValue();
  const onMessageAddListener = vi.fn();
  const storageGet = vi.fn();
  return {
    runtimeSendMessageMock: sendMessage,
    runtimeOnMessageAddListenerMock: onMessageAddListener,
    storageLocalGetMock: storageGet,
  };
});

const windowAddEventListenerSpy = vi.hoisted(() =>
  vi.spyOn(window, 'addEventListener')
);
const windowRemoveEventListenerSpy = vi.hoisted(() =>
  vi.spyOn(window, 'removeEventListener')
);

let runtimeMessageListener: ((message: unknown) => void) | undefined;

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      sendMessage: runtimeSendMessageMock,
      onMessage: {
        addListener: runtimeOnMessageAddListenerMock,
      },
    },
    storage: {
      local: {
        get: storageLocalGetMock,
      },
    },
  },
}));

const getBrowserStorageValueMock = vi.hoisted(() => vi.fn());

vi.mock('../src/storage', () => ({
  getBrowserStorageValue: getBrowserStorageValueMock,
}));

vi.mock('uuid', () => ({
  v4: () => 'button-uuid',
}));

const createInputElement = () => {
  const input = document.createElement('input');
  input.type = 'email';
  input.id = 'email';
  input.name = 'email';
  input.getBoundingClientRect = vi.fn(() => ({
    top: 40,
    bottom: 64,
    left: 120,
    right: 320,
    width: 200,
    height: 24,
    x: 120,
    y: 40,
    toJSON: () => ({}),
  }));
  document.body.appendChild(input);
  return input;
};

const focusInput = (input: HTMLInputElement) => {
  const event = new Event('focus');
  input.dispatchEvent(event);
};

describe('content script email button integration', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'complete',
    });
    runtimeSendMessageMock.mockReset();
    runtimeSendMessageMock.mockResolvedValue();
    runtimeOnMessageAddListenerMock.mockReset();
    runtimeOnMessageAddListenerMock.mockImplementation((listener) => {
      runtimeMessageListener = listener;
    });
    storageLocalGetMock.mockReset();
    getBrowserStorageValueMock.mockReset();
    runtimeMessageListener = undefined;
    windowAddEventListenerSpy.mockClear();
    windowRemoveEventListenerSpy.mockClear();
  });

  afterAll(() => {
    windowAddEventListenerSpy.mockRestore();
    windowRemoveEventListenerSpy.mockRestore();
  });

  it('surfaces the signed-out prompt when generation fails with an auth error', async () => {
    getBrowserStorageValueMock.mockImplementation(async (key: string) => {
      if (key === 'iCloudHmeOptions') {
        return {
          autofill: { button: true, contextMenu: true },
        };
      }
      if (key === 'clientState') {
        return undefined;
      }
      return undefined;
    });

    const input = createInputElement();

    const { default: main } = await import('../src/pages/Content/script');
    await main();

    expect(runtimeMessageListener).toBeDefined();

    focusInput(input);
    await Promise.resolve();

    const host = Array.from(document.body.children).find(
      (el): el is HTMLElement => el instanceof HTMLElement && !!el.shadowRoot
    );
    expect(host).toBeDefined();

    const button = host?.shadowRoot?.querySelector('button');
    expect(button).toBeDefined();
    expect(runtimeSendMessageMock).not.toHaveBeenCalled();
    const scrollCall = windowAddEventListenerSpy.mock.calls.find(
      ([eventName]) => eventName === 'scroll'
    );
    expect(scrollCall).toBeDefined();

    const scrollHandler = scrollCall?.[1] as EventListener;
    const rectMock = input.getBoundingClientRect as unknown as Mock<
      [],
      ReturnType<HTMLInputElement['getBoundingClientRect']>
    >;
    rectMock.mockReturnValueOnce({
      top: 140,
      bottom: 164,
      left: 220,
      right: 420,
      width: 200,
      height: 24,
      x: 220,
      y: 140,
      toJSON: () => ({}),
    });

    scrollHandler?.(new Event('scroll'));
    expect(button?.style.top).toBe('164px');
    expect(button?.style.left).toBe('220px');
    expect(button?.textContent).toBe('Please sign in to iCloud');
    expect(button?.hasAttribute('disabled')).toBe(true);
  });

  it('repositions the button when a scrollable ancestor scrolls', async () => {
    getBrowserStorageValueMock.mockImplementation(async (key: string) => {
      if (key === 'iCloudHmeOptions') {
        return {
          autofill: { button: true, contextMenu: true },
        };
      }
      if (key === 'clientState') {
        return undefined;
      }
      return undefined;
    });

    const container = document.createElement('div');
    container.style.height = '80px';
    container.style.overflowY = 'auto';
    const input = document.createElement('input');
    input.type = 'email';
    input.id = 'email';
    input.name = 'email';
    input.getBoundingClientRect = vi.fn(() => ({
      top: 40,
      bottom: 64,
      left: 120,
      right: 320,
      width: 200,
      height: 24,
      x: 120,
      y: 40,
      toJSON: () => ({}),
    }));

    container.appendChild(input);
    document.body.appendChild(container);

    const { default: main } = await import('../src/pages/Content/script');
    await main();

    focusInput(input);
    await Promise.resolve();

    const host = Array.from(document.body.children).find(
      (el): el is HTMLElement => el instanceof HTMLElement && !!el.shadowRoot
    );
    expect(host).toBeDefined();

    const button = host?.shadowRoot?.querySelector('button') as
      | HTMLButtonElement
      | undefined;
    expect(button).toBeDefined();

    const rectMock = input.getBoundingClientRect as unknown as Mock<
      [],
      ReturnType<HTMLInputElement['getBoundingClientRect']>
    >;
    rectMock.mockReturnValueOnce({
      top: 240,
      bottom: 264,
      left: 320,
      right: 520,
      width: 200,
      height: 24,
      x: 320,
      y: 240,
      toJSON: () => ({}),
    });

    container.dispatchEvent(new Event('scroll'));
    expect(button?.style.top).toBe('264px');
    expect(button?.style.left).toBe('320px');

    input.dispatchEvent(new Event('blur'));
    expect(host?.isConnected).toBe(false);
  });

  it('renders the generated alias and handles reservation responses', async () => {
    getBrowserStorageValueMock.mockImplementation(async (key: string) => {
      if (key === 'iCloudHmeOptions') {
        return {
          autofill: { button: true, contextMenu: true },
        };
      }
      if (key === 'clientState') {
        return {
          setupUrl: 'https://example.com/setup',
          webservices: {},
        };
      }
      return undefined;
    });

    const input = createInputElement();

    const { default: main } = await import('../src/pages/Content/script');
    await main();

    expect(runtimeMessageListener).toBeDefined();

    focusInput(input);
    await Promise.resolve();

    const host = Array.from(document.body.children).find(
      (el): el is HTMLElement => el instanceof HTMLElement && !!el.shadowRoot
    ) as HTMLElement | undefined;
    expect(host).toBeDefined();

    const button = host?.shadowRoot?.querySelector('button') as
      | HTMLButtonElement
      | undefined;
    expect(button).toBeDefined();

    runtimeMessageListener?.({
      type: MessageType.GenerateResponse,
      data: {
        elementId: 'button-uuid',
        hme: 'alias@example.com',
      },
    });

    expect(button?.textContent).toBe('alias@example.com');
    expect(button?.hasAttribute('disabled')).toBe(false);

    button?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await Promise.resolve();
    expect(runtimeSendMessageMock).toHaveBeenLastCalledWith({
      type: MessageType.ReservationRequest,
      data: {
        hme: 'alias@example.com',
        label: window.location.host,
        elementId: 'button-uuid',
      },
    });

    runtimeMessageListener?.({
      type: MessageType.ReservationResponse,
      data: {
        elementId: 'button-uuid',
        hme: 'alias@example.com',
      },
    });

    expect(input.value).toBe('alias@example.com');
    expect(host?.isConnected).toBe(false);
    const scrollCall = windowAddEventListenerSpy.mock.calls.find(
      ([eventName]) => eventName === 'scroll'
    );
    const scrollHandler = scrollCall?.[1] as EventListener;
    expect(
      windowRemoveEventListenerSpy.mock.calls.some(
        ([eventName, handler]) =>
          eventName === 'scroll' && handler === scrollHandler
      )
    ).toBe(true);
  });
});
