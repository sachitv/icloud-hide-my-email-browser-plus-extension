import {
  ActiveInputElementWriteData,
  GenerationResponseData,
  Message,
  MessageType,
  ReservationRequestData,
  ReservationResponseData,
} from '../../messages';
import { v4 as uuidv4 } from 'uuid';
import browser from 'webextension-polyfill';
import { getBrowserStorageValue, Options } from '../../storage';

const EMAIL_INPUT_QUERY_STRING =
  'input[type="email"], input[name="email"], input[id="email"]';

const LOADING_COPY = 'Hide My Email+ — Loading...';
const SIGNED_OUT_COPY = 'Please sign in to iCloud';

// A unique CSS class prefix is used to guarantee that the style injected
// by the extension does not interfere with the existing style of
// a web page.
const STYLE_CLASS_PREFIX = 'd1691f0f-b8f0-495e-9ffb-fe4e6f84b518';

const SHADOW_BUTTON_STYLES = `
:host,
* {
  box-sizing: border-box;
}
.${STYLE_CLASS_PREFIX}-button {
  border-radius: 1rem;
  padding: 0.625rem 1rem;
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-weight: 600;
  color: #ffffff;
  background-color: rgb(13, 12, 38);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 14px 28px -18px rgba(66, 133, 244, 0.35);
  transition: transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease, background-color 150ms ease;
  text-align: center;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  position: fixed;
  z-index: 9999;
  transform: translateY(0);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 0;
  pointer-events: auto;
  animation: ${STYLE_CLASS_PREFIX}-rainbow 2.5s linear infinite;
}
.${STYLE_CLASS_PREFIX}-hover-button:hover {
  transform: translateY(-0.125rem);
  box-shadow: 0 20px 35px -18px rgba(236, 72, 153, 0.45);
}
.${STYLE_CLASS_PREFIX}-cursor-not-allowed {
  cursor: not-allowed;
  background-color: rgb(13, 12, 38);
  color: rgba(255, 255, 255, 0.7);
  box-shadow: none;
  transform: translateY(0);
}
.${STYLE_CLASS_PREFIX}-cursor-progress {
  cursor: progress;
  opacity: 0.8;
  background-color: rgb(13, 12, 38);
}
.${STYLE_CLASS_PREFIX}-cursor-pointer {
  cursor: pointer;
}
@keyframes ${STYLE_CLASS_PREFIX}-rainbow {
  0% {
    color: #4285f4d9;
  }
  33% {
    color: #8b5cf6d9;
  }
  66% {
    color: #ec4899d9;
  }
  100% {
    color: #4285f4d9;
  }
}
`.trim();

const className = (shortName: string): string =>
  `${STYLE_CLASS_PREFIX}-${shortName}`;

const waitForDocumentReady = async (): Promise<void> => {
  if (document.readyState !== 'loading') {
    return;
  }

  await new Promise<void>((resolve) => {
    document.addEventListener('DOMContentLoaded', () => resolve(), {
      once: true,
    });
  });
};

type AutofillableInputElement = {
  inputElement: HTMLInputElement;
  buttonSupport?: {
    btnElement: HTMLButtonElement;
    hostElement: HTMLDivElement;
    appendTarget: HTMLElement;
    inputOnFocusCallback: (ev: FocusEvent) => void;
    inputOnBlurCallback: (ev: FocusEvent) => void;
    focusListenerOptions: AddEventListenerOptions;
    scrollListenerOptions: AddEventListenerOptions;
    repositionButton: () => void;
    btnOnMousedownCallback: (ev: MouseEvent) => void;
  };
};

const AUTOFILL_MANAGER_CLEANUP_KEY = Symbol.for(
  'icloud-hide-my-email/autofill-cleanup'
);

type CleanupAwareGlobal = typeof globalThis & {
  [AUTOFILL_MANAGER_CLEANUP_KEY]?: () => void;
};

const disableButton = (
  btn: HTMLButtonElement,
  cursorClass: string,
  copy: string
): void => {
  btn.textContent = copy;
  btn.setAttribute('disabled', 'true');
  btn.classList.remove(className('hover-button'));
  btn.classList.forEach((name) => {
    if (name.startsWith(className('cursor-'))) {
      btn.classList.remove(name);
    }
  });
  btn.classList.add(className(cursorClass));
};

const enableButton = (
  btn: HTMLButtonElement,
  cursorClass: string,
  copy: string
): void => {
  btn.textContent = copy;
  btn.removeAttribute('disabled');
  btn.classList.add(className('hover-button'));
  btn.classList.forEach((name) => {
    if (name.startsWith(className('cursor-'))) {
      btn.classList.remove(name);
    }
  });
  btn.classList.add(className(cursorClass));
};

const makeButtonSupport = (
  inputElement: HTMLInputElement,
  appendTarget: HTMLElement
): AutofillableInputElement['buttonSupport'] => {
  const eventOptions: AddEventListenerOptions = { capture: true };
  const scrollListenerOptions: AddEventListenerOptions = {
    capture: true,
    passive: true,
  };
  const hostElement = document.createElement('div');
  hostElement.style.position = 'fixed';
  hostElement.style.top = '0';
  hostElement.style.left = '0';
  hostElement.style.width = '0';
  hostElement.style.height = '0';
  hostElement.style.zIndex = '2147483647';

  const shadowRoot = hostElement.attachShadow({ mode: 'open' });
  const styleElement = document.createElement('style');
  styleElement.textContent = SHADOW_BUTTON_STYLES;
  const btnElement = document.createElement('button');
  const btnElementId = uuidv4();
  btnElement.setAttribute('id', btnElementId);
  btnElement.setAttribute('type', 'button');
  btnElement.classList.add(className('button'));
  shadowRoot.append(styleElement, btnElement);

  disableButton(btnElement, 'cursor-not-allowed', LOADING_COPY);

  const repositionButton = () => {
    if (!inputElement.isConnected || !hostElement.isConnected) {
      return;
    }

    const rect = inputElement.getBoundingClientRect();
    btnElement.style.top = `${rect.bottom}px`;
    btnElement.style.left = `${rect.left}px`;
    btnElement.style.width = `${rect.width}px`;
  };

  const inputOnFocusCallback = async () => {
    disableButton(btnElement, 'cursor-progress', LOADING_COPY);
    appendTarget.appendChild(hostElement);
    repositionButton();
    window.addEventListener('scroll', repositionButton, scrollListenerOptions);
    window.addEventListener('resize', repositionButton);

    const clientState = await getBrowserStorageValue('clientState');
    if (clientState === undefined) {
      disableButton(btnElement, 'cursor-not-allowed', SIGNED_OUT_COPY);
      return;
    }

    try {
      await browser.runtime.sendMessage({
        type: MessageType.GenerateRequest,
        data: btnElementId,
      });
    } catch (_error) {
      disableButton(btnElement, 'cursor-not-allowed', SIGNED_OUT_COPY);
    }
  };

  inputElement.addEventListener('focus', inputOnFocusCallback, eventOptions);

  const inputOnBlurCallback = () => {
    disableButton(btnElement, 'cursor-not-allowed', LOADING_COPY);
    hostElement.remove();
    window.removeEventListener(
      'scroll',
      repositionButton,
      scrollListenerOptions
    );
    window.removeEventListener('resize', repositionButton);
  };

  inputElement.addEventListener('blur', inputOnBlurCallback, eventOptions);

  const btnOnMousedownCallback = async (ev: MouseEvent) => {
    ev.preventDefault();
    const hme = btnElement.textContent ?? '';
    disableButton(btnElement, 'cursor-progress', LOADING_COPY);
    await browser.runtime.sendMessage({
      type: MessageType.ReservationRequest,
      data: { hme, label: window.location.host, elementId: btnElement.id },
    } as Message<ReservationRequestData>);
  };

  btnElement.addEventListener('mousedown', btnOnMousedownCallback);

  return {
    btnElement,
    hostElement,
    inputOnFocusCallback,
    inputOnBlurCallback,
    focusListenerOptions: eventOptions,
    scrollListenerOptions,
    repositionButton,
    btnOnMousedownCallback,
  };
};

const removeButtonSupport = (
  inputElement: HTMLInputElement,
  buttonSupport: NonNullable<AutofillableInputElement['buttonSupport']>
): void => {
  const {
    btnElement,
    hostElement,
    inputOnFocusCallback,
    inputOnBlurCallback,
    focusListenerOptions,
    scrollListenerOptions,
    repositionButton,
  } = buttonSupport;
  inputElement.removeEventListener(
    'focus',
    inputOnFocusCallback,
    focusListenerOptions
  );
  inputElement.removeEventListener(
    'blur',
    inputOnBlurCallback,
    focusListenerOptions
  );
  window.removeEventListener('scroll', repositionButton, scrollListenerOptions);
  window.removeEventListener('resize', repositionButton);
  btnElement.remove();
  if (hostElement.isConnected) {
    hostElement.remove();
  }
};

class AutofillManager {
  private readonly appendTarget: HTMLElement;

  private readonly options: Options | undefined;

  private readonly autofillableInputElements: AutofillableInputElement[];

  constructor({
    appendTarget,
    options,
    initialInputElements,
  }: {
    appendTarget: HTMLElement;
    options: Options | undefined;
    initialInputElements: NodeListOf<HTMLInputElement>;
  }) {
    this.appendTarget = appendTarget;
    this.options = options;
    this.autofillableInputElements = Array.from(initialInputElements).map(
      (inputElement) => this.createAutofillableInputElement(inputElement)
    );
  }

  handleMessage = (message: Message<unknown>) => {
    switch (message.type) {
      case MessageType.Autofill:
        this.applyAutofillValue(message.data as string | undefined);
        break;
      case MessageType.GenerateResponse:
        this.handleGenerateResponse(
          message.data as GenerationResponseData | undefined
        );
        break;
      case MessageType.ReservationResponse:
        this.handleReservationResponse(
          message.data as ReservationResponseData | undefined
        );
        break;
      case MessageType.ActiveInputElementWrite:
        this.handleActiveInputElementWrite(
          message.data as ActiveInputElementWriteData | undefined
        );
        break;
      default:
        break;
    }
  };

  handleMutations: MutationCallback = (mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(this.processAddedNode);
      mutation.removedNodes.forEach(this.processRemovedNode);
    });
  };

  private createAutofillableInputElement = (
    inputElement: HTMLInputElement
  ): AutofillableInputElement => {
    const shouldCreateButton = this.options?.autofill.button !== false;
    return {
      inputElement,
      buttonSupport: shouldCreateButton
        ? makeButtonSupport(inputElement, this.appendTarget)
        : undefined,
    };
  };

  private processAddedNode = (node: Node) => {
    if (!(node instanceof Element)) {
      return;
    }

    const directCandidate =
      node instanceof HTMLInputElement ? [node] : undefined;
    const addedElements = node.querySelectorAll<HTMLInputElement>(
      EMAIL_INPUT_QUERY_STRING
    );
    [...(directCandidate ?? []), ...addedElements].forEach((element) => {
      const elementExists = this.autofillableInputElements.some((item) =>
        element.isEqualNode(item.inputElement)
      );
      if (!elementExists) {
        this.autofillableInputElements.push(
          this.createAutofillableInputElement(element)
        );
      }
    });
  };

  private processRemovedNode = (node: Node) => {
    if (!(node instanceof Element)) {
      return;
    }

    const directCandidate =
      node instanceof HTMLInputElement ? [node] : undefined;
    const removedElements = node.querySelectorAll<HTMLInputElement>(
      EMAIL_INPUT_QUERY_STRING
    );
    [...(directCandidate ?? []), ...removedElements].forEach((element) => {
      const foundIndex = this.autofillableInputElements.findIndex((item) =>
        element.isEqualNode(item.inputElement)
      );
      if (foundIndex === -1) {
        return;
      }

      const [{ inputElement, buttonSupport }] =
        this.autofillableInputElements.splice(foundIndex, 1);
      if (buttonSupport) {
        removeButtonSupport(inputElement, buttonSupport);
      }
    });
  };

  private findButtonSupportById = (
    elementId: string | undefined
  ): AutofillableInputElement['buttonSupport'] => {
    if (!elementId) {
      return undefined;
    }

    return this.autofillableInputElements.find(
      (item) => item.buttonSupport?.btnElement.id === elementId
    )?.buttonSupport;
  };

  private findElementByButtonId = (elementId: string | undefined) => {
    if (!elementId) {
      return undefined;
    }

    return this.autofillableInputElements.find(
      (item) => item.buttonSupport?.btnElement.id === elementId
    );
  };

  private applyAutofillValue = (value: string | undefined) => {
    if (value === undefined) {
      return;
    }

    this.autofillableInputElements.forEach(
      ({ inputElement, buttonSupport }) => {
        inputElement.value = value;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        if (buttonSupport) {
          removeButtonSupport(inputElement, buttonSupport);
        }
      }
    );
  };

  private handleGenerateResponse = (
    payload: GenerationResponseData | undefined
  ) => {
    if (!payload) {
      return;
    }

    const buttonSupport = this.findButtonSupportById(payload.elementId);
    const element = buttonSupport?.btnElement;
    if (!element) {
      return;
    }

    if (payload.error) {
      disableButton(element, 'cursor-not-allowed', payload.error);
      return;
    }

    if (!payload.hme) {
      return;
    }

    enableButton(element, 'cursor-pointer', payload.hme);
  };

  private handleReservationResponse = (
    payload: ReservationResponseData | undefined
  ) => {
    if (!payload) {
      return;
    }

    const entry = this.findElementByButtonId(payload.elementId);
    const btnElement = entry?.buttonSupport?.btnElement;
    if (!btnElement) {
      return;
    }

    if (payload.error) {
      disableButton(btnElement, 'cursor-not-allowed', payload.error);
      return;
    }

    if (!payload.hme) {
      return;
    }

    const { inputElement, buttonSupport } = entry;
    inputElement.value = payload.hme;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    if (buttonSupport) {
      removeButtonSupport(inputElement, buttonSupport);
    }
  };

  private handleActiveInputElementWrite = (
    payload: ActiveInputElementWriteData | undefined
  ) => {
    const { activeElement } = document;
    if (!activeElement || !(activeElement instanceof HTMLInputElement)) {
      return;
    }

    if (!payload) {
      return;
    }

    const { text, copyToClipboard } = payload;
    activeElement.value = text;
    activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    activeElement.dispatchEvent(new Event('change', { bubbles: true }));
    if (copyToClipboard) {
      navigator.clipboard.writeText(text);
    }

    const found = this.autofillableInputElements.find((item) =>
      item.inputElement.isEqualNode(activeElement)
    );
    if (found?.buttonSupport) {
      removeButtonSupport(activeElement, found.buttonSupport);
    }
  };

  dispose = () => {
    this.autofillableInputElements.forEach(
      ({ inputElement, buttonSupport }) => {
        if (buttonSupport) {
          removeButtonSupport(inputElement, buttonSupport);
        }
      }
    );
    this.autofillableInputElements.splice(
      0,
      this.autofillableInputElements.length
    );
  };
}

export default async function main(): Promise<void> {
  await waitForDocumentReady();

  const appendTarget = document.body ?? document.documentElement;
  if (!appendTarget) {
    return;
  }

  const cleanupAwareGlobal = globalThis as CleanupAwareGlobal;
  cleanupAwareGlobal[AUTOFILL_MANAGER_CLEANUP_KEY]?.();

  const emailInputElements = document.querySelectorAll<HTMLInputElement>(
    EMAIL_INPUT_QUERY_STRING
  );

  const options = await getBrowserStorageValue('iCloudHmeOptions');

  const autofillManager = new AutofillManager({
    appendTarget,
    options,
    initialInputElements: emailInputElements,
  });

  const observer = new MutationObserver(autofillManager.handleMutations);
  observer.observe(appendTarget, {
    childList: true,
    attributes: false,
    subtree: true,
  });

  const runtimeListener = (uncastedMessage: unknown) => {
    const message = uncastedMessage as Message<unknown>;
    autofillManager.handleMessage(message);
    return undefined;
  };

  browser.runtime.onMessage.addListener(runtimeListener);

  cleanupAwareGlobal[AUTOFILL_MANAGER_CLEANUP_KEY] = () => {
    observer.disconnect();
    browser.runtime.onMessage.removeListener(runtimeListener);
    autofillManager.dispose();
  };
}
