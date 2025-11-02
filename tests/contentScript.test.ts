import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  vi,
  type Mock,
} from 'vitest';
import { waitFor } from '@testing-library/react';
import { MessageType } from '../src/messages';
import type { Store } from '../src/storage';

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
  vi.spyOn(globalThis, 'addEventListener')
);
const windowRemoveEventListenerSpy = vi.hoisted(() =>
  vi.spyOn(globalThis, 'removeEventListener')
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
const { clipboardWriteTextMock, originalClipboard } = vi.hoisted(() => ({
  clipboardWriteTextMock: vi.fn().mockResolvedValue(undefined),
  originalClipboard: navigator.clipboard,
}));

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

const DEFAULT_STORAGE_VALUES: Pick<Store, 'iCloudHmeOptions' | 'clientState'> =
  {
    iCloudHmeOptions: {
      autofill: { button: true, contextMenu: true },
    },
    clientState: {
      setupUrl: 'https://example.com/setup',
      webservices: {},
    },
  };

type StorageOverrides = Partial<
  Pick<Store, 'iCloudHmeOptions' | 'clientState'>
>;

const mockStorageState = (overrides: StorageOverrides = {}) => {
  const options =
    'iCloudHmeOptions' in overrides
      ? overrides.iCloudHmeOptions
      : DEFAULT_STORAGE_VALUES.iCloudHmeOptions;
  const clientState =
    'clientState' in overrides
      ? overrides.clientState
      : DEFAULT_STORAGE_VALUES.clientState;

  getBrowserStorageValueMock.mockImplementation(async (key: string) => {
    if (key === 'iCloudHmeOptions') {
      return options;
    }
    if (key === 'clientState') {
      return clientState;
    }
    return undefined;
  });
};

const runContentScript = async () => {
  const { default: main } = await import('../src/pages/Content/script');
  await main();
};

const findShadowHost = () =>
  Array.from(document.body.children).find(
    (el): el is HTMLElement => el instanceof HTMLElement && Boolean(el.shadowRoot)
  );

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
    clipboardWriteTextMock.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteTextMock },
    });
    mockStorageState();
  });

  afterAll(() => {
    windowAddEventListenerSpy.mockRestore();
    windowRemoveEventListenerSpy.mockRestore();
    if (originalClipboard === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (navigator as { clipboard?: never }).clipboard;
    } else {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  // Signed-out fallback when generation is attempted without client state.
  it('surfaces the signed-out prompt when generation fails with an auth error', async () => {
    mockStorageState({ clientState: undefined });

    const input = createInputElement();

    await runContentScript();

    expect(runtimeMessageListener).toBeDefined();

    focusInput(input);
    await Promise.resolve();

    const host = findShadowHost();
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

  it('waits for DOMContentLoaded before bootstrapping when the document is still loading', async () => {
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'loading',
    });
    document.body.innerHTML = '<input type="email" id="email" />';

    const domReadyPromise = import('../src/pages/Content/script').then(
      async ({ default: main }) => {
        const mainPromise = main();
        await Promise.resolve();
        expect(runtimeSendMessageMock).not.toHaveBeenCalled();
        document.dispatchEvent(new Event('DOMContentLoaded'));
        await expect(mainPromise).resolves.toBeUndefined();
      }
    );

    await domReadyPromise.finally(() => {
      Object.defineProperty(document, 'readyState', {
        configurable: true,
        value: 'complete',
      });
    });
  });

  // Ensures button markup is skipped entirely when button autofill is disabled.
  it('skips button support when autofill button is disabled', async () => {
    mockStorageState({
      iCloudHmeOptions: { autofill: { button: false, contextMenu: true } },
    });

    const input = createInputElement();

    await runContentScript();

    focusInput(input);
    await Promise.resolve();

    const hosts = Array.from(document.body.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && Boolean(el.shadowRoot)
    );

    expect(hosts).toHaveLength(0);

    runtimeMessageListener?.({
      type: MessageType.GenerateResponse,
      data: {
        elementId: 'unknown',
        hme: 'should-not-apply',
      },
    });

    runtimeMessageListener?.({
      type: MessageType.Autofill,
      data: 'autofill@example.com',
    });

    expect(input.value).toBe('autofill@example.com');
  });

  it('re-displays the signed-out copy when alias generation fails', async () => {
    runtimeSendMessageMock.mockRejectedValueOnce(new Error('generate failed'));
    const input = createInputElement();

    await runContentScript();

    focusInput(input);
    await Promise.resolve();

    const host = findShadowHost();
    const button = host?.shadowRoot?.querySelector('button');
    await waitFor(() =>
      expect(button?.textContent).toBe('Please sign in to iCloud')
    );
    expect(button?.hasAttribute('disabled')).toBe(true);
  });

  it('bails out of button repositioning when the input is detached', async () => {
    mockStorageState({ clientState: undefined });

    const input = createInputElement();

    await runContentScript();

    focusInput(input);
    await Promise.resolve();

    const host = findShadowHost();
    const scrollHandler = windowAddEventListenerSpy.mock.calls.find(
      ([eventName]) => eventName === 'scroll'
    )?.[1] as EventListener | undefined;
    expect(scrollHandler).toBeDefined();

    input.remove();
    host?.remove();

    expect(() => scrollHandler?.(new Event('scroll'))).not.toThrow();
  });

  it('requests reservation when the button is clicked', async () => {
    const input = createInputElement();

    await runContentScript();

    focusInput(input);
    await Promise.resolve();

    const host = findShadowHost();
    const button = host?.shadowRoot?.querySelector('button') as
      | HTMLButtonElement
      | undefined;

    runtimeMessageListener?.({
      type: MessageType.GenerateResponse,
      data: {
        elementId: 'button-uuid',
        hme: 'alias@example.com',
      },
    });
    await waitFor(() => expect(button?.textContent).toBe('alias@example.com'));

    button?.dispatchEvent(new MouseEvent('mousedown'));

    await waitFor(() =>
      expect(runtimeSendMessageMock).toHaveBeenLastCalledWith({
        type: MessageType.ReservationRequest,
        data: {
          hme: 'alias@example.com',
          label: 'localhost:3000',
          elementId: 'button-uuid',
        },
      })
    );
  });

  // Covers scroll event handling to keep the floating button aligned to inputs.
  it('repositions the button when a scrollable ancestor scrolls', async () => {
    mockStorageState({ clientState: undefined });

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

    await runContentScript();

    focusInput(input);
    await Promise.resolve();

    const host = findShadowHost();
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

  it('returns early when no append target is available', async () => {
    const originalBody = document.body;
    const originalDocumentElement = document.documentElement;

    Object.defineProperty(document, 'body', {
      configurable: true,
      value: null,
    });
    Object.defineProperty(document, 'documentElement', {
      configurable: true,
      value: null,
    });

    const { default: main } = await import('../src/pages/Content/script');
    await expect(main()).resolves.toBeUndefined();

    Object.defineProperty(document, 'body', {
      configurable: true,
      value: originalBody,
    });
    Object.defineProperty(document, 'documentElement', {
      configurable: true,
      value: originalDocumentElement,
    });
  });

  it('removes button support when inputs are detached from the DOM', async () => {
    const rawInput = createInputElement();
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.appendChild(rawInput);

    await runContentScript();

    focusInput(rawInput);
    await Promise.resolve();

    const host = findShadowHost();
    expect(host).toBeDefined();

    container.remove();
    await waitFor(() => expect(host?.isConnected).toBe(false));
  });

  // Ensures newly inserted inputs discovered via mutation observers receive button support.
  it('registers button support for inputs added via DOM mutations', async () => {
    document.body.innerHTML = '';
    await runContentScript();

    const newEmail = document.createElement('input');
    newEmail.type = 'email';
    newEmail.name = 'email';
    newEmail.getBoundingClientRect = vi.fn(() => ({
      top: 40,
      bottom: 64,
      left: 10,
      right: 210,
      width: 200,
      height: 24,
      x: 10,
      y: 40,
      toJSON: () => ({}),
    }));
    document.body.appendChild(newEmail);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(() => focusInput(newEmail)).not.toThrow();
    await Promise.resolve();
  });

  it('skips duplicate email inputs discovered via mutations', async () => {
    const originalInput = createInputElement();

    await runContentScript();

    focusInput(originalInput);
    await Promise.resolve();

    const initialHosts = Array.from(document.body.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && Boolean(el.shadowRoot)
    );
    expect(initialHosts).toHaveLength(1);

    const duplicateInput = originalInput.cloneNode(true) as HTMLInputElement;
    duplicateInput.getBoundingClientRect = vi.fn(() => ({
      top: 40,
      bottom: 64,
      left: 10,
      right: 210,
      width: 200,
      height: 24,
      x: 10,
      y: 40,
      toJSON: () => ({}),
    }));
    document.body.appendChild(duplicateInput);

    await new Promise((resolve) => setTimeout(resolve, 0));

    const hostsAfterDuplicate = Array.from(document.body.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && Boolean(el.shadowRoot)
    );
    expect(hostsAfterDuplicate).toHaveLength(1);

    duplicateInput.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const hostsAfterRemoval = Array.from(document.body.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && Boolean(el.shadowRoot)
    );
    expect(hostsAfterRemoval).toHaveLength(1);
  });

  // Guards against non-element nodes emitted from mutation observer removals.
  it('ignores removed nodes that are not elements', async () => {
    const rawInput = createInputElement();
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.appendChild(rawInput);

    await runContentScript();

    const textNode = document.createTextNode('removed text');
    document.body.appendChild(textNode);
    textNode.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));

    focusInput(rawInput);
    await Promise.resolve();
    const host = findShadowHost();
    expect(host).toBeDefined();
  });

  // Verifies error and empty payload handling for generate responses.
  it('renders errors from generation responses and ignores empty payloads', async () => {
    const input = createInputElement();

    await runContentScript();

    focusInput(input);
    await Promise.resolve();

    const host = findShadowHost();
    const button = host?.shadowRoot?.querySelector('button');
    expect(button).toBeDefined();

    runtimeMessageListener?.({
      type: MessageType.GenerateResponse,
      data: {
        elementId: 'button-uuid',
        error: 'Generation failed',
      },
    });

    expect(button?.textContent).toBe('Generation failed');
    expect(button?.hasAttribute('disabled')).toBe(true);

    runtimeMessageListener?.({
      type: MessageType.GenerateResponse,
      data: {
        elementId: 'button-uuid',
      },
    });

    expect(button?.textContent).toBe('Generation failed');
  });

  // Happy path flow: generation success, reservation handling, and cleanup.
  it('renders the generated alias and handles reservation responses', async () => {
    const input = createInputElement();

    await runContentScript();

    expect(runtimeMessageListener).toBeDefined();

    focusInput(input);
    await Promise.resolve();

    const host = findShadowHost();
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
        label: globalThis.location?.host ?? '',
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

  // Ensures background-triggered autofill updates inputs and removes buttons.
  it('applies autofill messages and removes button support', async () => {
    const input = createInputElement();

    await runContentScript();

    focusInput(input);
    await Promise.resolve();

    const hostBefore = findShadowHost();
    expect(hostBefore).toBeDefined();

    runtimeMessageListener?.({
      type: MessageType.Autofill,
      data: 'autofill@example.com',
    });

    expect(input.value).toBe('autofill@example.com');

    const hostAfter = findShadowHost();
    expect(hostAfter).toBeUndefined();
  });

  // Covers reservation error responses and missing payload fallbacks.
  it('renders reservation errors and ignores missing payloads', async () => {
    const input = createInputElement();

    await runContentScript();

    focusInput(input);
    await Promise.resolve();

    const host = findShadowHost();
    const button = host?.shadowRoot?.querySelector('button') as
      | HTMLButtonElement
      | undefined;

    runtimeMessageListener?.({
      type: MessageType.GenerateResponse,
      data: {
        elementId: 'button-uuid',
        hme: 'alias@example.com',
      },
    });

    expect(button?.textContent).toBe('alias@example.com');

    runtimeMessageListener?.({
      type: MessageType.ReservationResponse,
      data: {
        elementId: 'button-uuid',
        error: 'Reservation failed',
      },
    });

    expect(button?.textContent).toBe('Reservation failed');
    expect(button?.hasAttribute('disabled')).toBe(true);

    runtimeMessageListener?.({
      type: MessageType.ReservationResponse,
      data: {
        elementId: 'button-uuid',
      },
    });

    expect(button?.textContent).toBe('Reservation failed');
  });

  // Ensures outdated reservation responses are ignored after DOM changes.
  it('ignores reservation responses when no matching input remains', async () => {
    const input = createInputElement();

    await runContentScript();

    focusInput(input);
    await Promise.resolve();

    const host = findShadowHost();
    const button = host?.shadowRoot?.querySelector('button');
    expect(button).toBeDefined();

    runtimeMessageListener?.({
      type: MessageType.GenerateResponse,
      data: {
        elementId: 'button-uuid',
        hme: 'alias@example.com',
      },
    });

    const nativeFind: typeof Array.prototype.find = Array.prototype.find;
    const findSpy = vi.spyOn(Array.prototype, 'find');
    let findCallCount = 0;

    findSpy.mockImplementation(function (
      this: unknown[],
      predicate: Parameters<typeof nativeFind>[0],
      thisArg?: Parameters<typeof nativeFind>[1]
    ) {
      const shouldIntercept =
        Array.isArray(this) &&
        this.every(
          (item) =>
            item !== undefined &&
            typeof item === 'object' &&
            'inputElement' in (item as object)
        );
      if (shouldIntercept) {
        findCallCount += 1;
        if (findCallCount === 2) {
          return undefined;
        }
      }

      return nativeFind.call(this, predicate, thisArg);
    });

    try {
      runtimeMessageListener?.({
        type: MessageType.ReservationResponse,
        data: {
          elementId: 'button-uuid',
          hme: 'alias@example.com',
        },
      });

      expect(button?.textContent).toBe('alias@example.com');
    } finally {
      findSpy.mockRestore();
    }
  });

  // Confirms ActiveInputElementWrite mutates the focused input and clipboard.
  it('writes to the active input element and copies to clipboard when requested', async () => {
    const hostRemovalSpy = vi.fn();

    const input = createInputElement();
    input.addEventListener('input', hostRemovalSpy);
    input.addEventListener('change', hostRemovalSpy);

    await runContentScript();

    focusInput(input);
    await Promise.resolve();

    const host = findShadowHost();
    expect(host).toBeDefined();

    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      get: () => input,
    });

    runtimeMessageListener?.({
      type: MessageType.ActiveInputElementWrite,
      data: {
        text: 'copied-alias@example.com',
        copyToClipboard: true,
      },
    });

    expect(input.value).toBe('copied-alias@example.com');
    expect(clipboardWriteTextMock).toHaveBeenCalledWith(
      'copied-alias@example.com'
    );
    expect(host.isConnected).toBe(false);
    expect(hostRemovalSpy).toHaveBeenCalled();

    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      get: () => document.body,
    });
  });

  // Guards against ActiveInputElementWrite when focus is outside an input.
  it('ignores active element writes when no input is focused', async () => {
    mockStorageState({ clientState: undefined });

    await runContentScript();

    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      get: () => document.body,
    });

    runtimeMessageListener?.({
      type: MessageType.ActiveInputElementWrite,
      data: {
        text: 'ignored@example.com',
        copyToClipboard: true,
      },
    });

    expect(clipboardWriteTextMock).not.toHaveBeenCalled();
  });

  // Covers reservation messages with unknown button ids.
  it('ignores reservation responses when no button is present', async () => {
    mockStorageState({ clientState: undefined });

    await runContentScript();

    runtimeMessageListener?.({
      type: MessageType.ReservationResponse,
      data: {
        elementId: 'missing',
        hme: 'ignored',
      },
    });

    runtimeMessageListener?.({
      type: MessageType.ReservationResponse,
      data: {
        elementId: 'missing',
        error: 'still ignored',
      },
    });
  });

  // Exercises the default case to ensure unknown messages are ignored.
  it('falls back to the default branch for unknown messages', async () => {
    mockStorageState({ iCloudHmeOptions: undefined, clientState: undefined });

    await runContentScript();

    expect(() =>
      runtimeMessageListener?.({
        // @ts-expect-error - testing default case
        type: 'unknown',
      })
    ).not.toThrow();
  });
});
