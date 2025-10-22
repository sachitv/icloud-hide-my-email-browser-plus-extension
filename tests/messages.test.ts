import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageType, sendMessageToTab } from '../src/messages';

const { browserTabsMocks } = vi.hoisted(() => ({
  browserTabsMocks: {
    tabs: {
      query: vi.fn(),
      sendMessage: vi.fn(),
    },
  },
}));

vi.mock('webextension-polyfill', () => ({
  __esModule: true,
  default: browserTabsMocks,
}));

describe('messaging utilities', () => {
  beforeEach(() => {
    browserTabsMocks.tabs.query.mockReset();
    browserTabsMocks.tabs.sendMessage.mockReset();
  });

  // Direct tab id should short-circuit the tab query.
  it('uses the provided tab id when available', async () => {
    await sendMessageToTab(MessageType.Autofill, 'test', { id: 42 } as never);

    expect(browserTabsMocks.tabs.query).not.toHaveBeenCalled();
    expect(browserTabsMocks.tabs.sendMessage).toHaveBeenCalledWith(42, {
      type: MessageType.Autofill,
      data: 'test',
    });
  });

  // Without a tab id we expect a query for the active tab.
  it('queries the active tab when none is provided', async () => {
    browserTabsMocks.tabs.query.mockResolvedValue([{ id: 7 }]);

    await sendMessageToTab(MessageType.GenerateRequest, { foo: 'bar' });

    expect(browserTabsMocks.tabs.query).toHaveBeenCalledWith({
      active: true,
      lastFocusedWindow: true,
    });
    expect(browserTabsMocks.tabs.sendMessage).toHaveBeenCalledWith(7, {
      type: MessageType.GenerateRequest,
      data: { foo: 'bar' },
    });
  });

  // Missing ids should be ignored instead of throwing.
  it('guards against missing tab ids', async () => {
    browserTabsMocks.tabs.query.mockResolvedValue([{}]);

    await sendMessageToTab(MessageType.GenerateResponse, 'payload');

    expect(browserTabsMocks.tabs.sendMessage).not.toHaveBeenCalled();
  });
});
