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
import { getBrowserStorageValue } from '../../storage';

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
    } catch (error) {
      console.debug(
        'Hide My Email+: Failed to request alias generation',
        error
      );
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

export default async function main(): Promise<void> {
  await waitForDocumentReady();

  const appendTarget = document.body ?? document.documentElement;
  if (!appendTarget) {
    return;
  }

  const emailInputElements = document.querySelectorAll<HTMLInputElement>(
    EMAIL_INPUT_QUERY_STRING
  );

  const findButtonSupportById = (elementId: string) =>
    autofillableInputElements.find(
      (item) => item.buttonSupport?.btnElement.id === elementId
    )?.buttonSupport;

  const options = await getBrowserStorageValue('iCloudHmeOptions');

  const makeAutofillableInputElement = (
    inputElement: HTMLInputElement
  ): AutofillableInputElement => ({
    inputElement,
    buttonSupport:
      options?.autofill.button === false
        ? undefined
        : makeButtonSupport(inputElement, appendTarget),
  });

  const autofillableInputElements = Array.from(emailInputElements).map(
    makeAutofillableInputElement
  );

  const mutationCallback: MutationCallback = (mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) {
          return;
        }

        const addedElements = node.querySelectorAll<HTMLInputElement>(
          EMAIL_INPUT_QUERY_STRING
        );
        addedElements.forEach((el) => {
          const elementExists = autofillableInputElements.some((item) =>
            el.isEqualNode(item.inputElement)
          );
          if (!elementExists) {
            autofillableInputElements.push(makeAutofillableInputElement(el));
          }
        });
      });

      mutation.removedNodes.forEach((node) => {
        if (!(node instanceof Element)) {
          return;
        }

        const removedElements = node.querySelectorAll<HTMLInputElement>(
          EMAIL_INPUT_QUERY_STRING
        );
        removedElements.forEach((el) => {
          const foundIndex = autofillableInputElements.findIndex((item) =>
            el.isEqualNode(item.inputElement)
          );
          if (foundIndex !== -1) {
            const [{ inputElement, buttonSupport }] =
              autofillableInputElements.splice(foundIndex, 1);

            buttonSupport && removeButtonSupport(inputElement, buttonSupport);
          }
        });
      });
    });
  };

  const observer = new MutationObserver(mutationCallback);
  observer.observe(appendTarget, {
    childList: true,
    attributes: false,
    subtree: true,
  });

  browser.runtime.onMessage.addListener((uncastedMessage: unknown) => {
    const message = uncastedMessage as Message<unknown>;

    switch (message.type) {
      case MessageType.Autofill:
        autofillableInputElements.forEach(({ inputElement, buttonSupport }) => {
          inputElement.value = message.data as string;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
          buttonSupport && removeButtonSupport(inputElement, buttonSupport);
        });
        break;
      case MessageType.GenerateResponse:
        {
          const { hme, elementId, error } =
            message.data as GenerationResponseData;

          const buttonSupport = findButtonSupportById(elementId);
          const element = buttonSupport?.btnElement;
          if (!element) {
            break;
          }

          if (error) {
            disableButton(element, 'cursor-not-allowed', error);
            break;
          }

          if (!hme) {
            break;
          }

          enableButton(element, 'cursor-pointer', hme);
        }
        break;
      case MessageType.ReservationResponse:
        {
          const { hme, error, elementId } =
            message.data as ReservationResponseData;

          const buttonSupport = findButtonSupportById(elementId);
          const btnElement = buttonSupport?.btnElement;
          if (!btnElement) {
            break;
          }

          if (error) {
            disableButton(btnElement, 'cursor-not-allowed', error);
            break;
          }

          if (!hme) {
            break;
          }

          const found = autofillableInputElements.find(
            (ael) => ael.buttonSupport?.btnElement.id === btnElement.id
          );
          if (!found) {
            break;
          }

          const { inputElement, buttonSupport: activeButtonSupport } = found;
          inputElement.value = hme;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
          inputElement.dispatchEvent(new Event('change', { bubbles: true }));

          activeButtonSupport &&
            removeButtonSupport(inputElement, activeButtonSupport);
        }
        break;
      case MessageType.ActiveInputElementWrite:
        {
          const { activeElement } = document;
          if (!activeElement || !(activeElement instanceof HTMLInputElement)) {
            break;
          }

          const {
            data: { text, copyToClipboard },
          } = message as Message<ActiveInputElementWriteData>;
          activeElement.value = text;
          activeElement.dispatchEvent(new Event('input', { bubbles: true }));
          activeElement.dispatchEvent(new Event('change', { bubbles: true }));
          copyToClipboard && navigator.clipboard.writeText(text);

          // Remove button if it exists. This should rarely happen as context menu
          // users are expected to have turned off button support.
          const found = autofillableInputElements.find((ael) =>
            ael.inputElement.isEqualNode(activeElement)
          );
          found?.buttonSupport &&
            removeButtonSupport(activeElement, found.buttonSupport);
        }
        break;
      default:
        break;
    }

    return undefined;
  });
}
