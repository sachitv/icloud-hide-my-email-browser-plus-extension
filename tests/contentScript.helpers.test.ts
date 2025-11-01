import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
      },
    },
    storage: {
      local: {
        get: vi.fn(),
      },
    },
  },
}));

vi.mock('../src/storage', () => ({
  getBrowserStorageValue: vi.fn(),
}));

let helpers: typeof import('../src/pages/Content/script')['__testUtils'];

beforeAll(async () => {
  ({ __testUtils: helpers } = await import('../src/pages/Content/script'));
});

describe('content script mutation helpers', () => {
  it('does not add duplicate autofillable inputs', () => {
    const trackedInput = document.createElement('input');
    trackedInput.type = 'email';
    trackedInput.name = 'email';

    const duplicateInput = trackedInput.cloneNode(true) as HTMLInputElement;

    const elements = [{ inputElement: trackedInput }];
    const makeAutofillableInputElement = vi.fn(() => ({
      inputElement: duplicateInput,
    }));

    helpers.addAutofillableInputElementIfMissing(
      elements,
      makeAutofillableInputElement,
      duplicateInput
    );

    expect(elements).toHaveLength(1);
    expect(makeAutofillableInputElement).not.toHaveBeenCalled();
  });

  it('returns early when removing an untracked input', () => {
    const trackedInput = document.createElement('input');
    trackedInput.type = 'email';
    trackedInput.name = 'email';

    const otherInput = document.createElement('input');
    otherInput.type = 'email';
    otherInput.name = 'different-email';

    const elements = [{ inputElement: trackedInput }];

    helpers.removeAutofillableInputElementIfPresent(elements, otherInput);

    expect(elements).toHaveLength(1);
  });
});
