import browser from 'webextension-polyfill';
import {
  Message,
  MessageType,
  ReservationRequestData,
  sendMessageToTab,
} from '../../messages';
import { getBrowserStorageValue } from '../../storage';
import ICloudClient, { PremiumMailSettings } from '../../iCloudClient';
import { SIGNED_OUT_CTA_COPY } from '../../constants';
import { formatError } from '../../utils/formatError';
import { performDeauthSideEffects } from './authSync';

export const setupMessageHandlers = () => {
  browser.runtime.onMessage.addListener(async (uncastedMessage: unknown) => {
    const message = uncastedMessage as Message<unknown>;

    switch (message.type) {
      case MessageType.GenerateRequest:
        {
          const elementId = message.data as string;

          const deauthCallback = async () => {
            await sendMessageToTab(MessageType.GenerateResponse, {
              error: SIGNED_OUT_CTA_COPY,
              elementId,
            });
            await performDeauthSideEffects();
          };

          const clientState = await getBrowserStorageValue('clientState');
          if (clientState === undefined) {
            await deauthCallback();
            break;
          }

          const client = new ICloudClient(
            clientState.setupUrl,
            clientState.webservices
          );
          const isClientAuthenticated = await client.isAuthenticated();
          if (!isClientAuthenticated) {
            await deauthCallback();
            break;
          }

          try {
            const pms = new PremiumMailSettings(client);
            const hme = await pms.generateHme();
            await sendMessageToTab(MessageType.GenerateResponse, {
              hme,
              elementId,
            });
          } catch (e) {
            await sendMessageToTab(MessageType.GenerateResponse, {
              error: formatError(e),
              elementId,
            });
          }
        }
        break;
      case MessageType.ReservationRequest:
        {
          const { hme, label, elementId } =
            message.data as ReservationRequestData;

          const deauthCallback = async () => {
            await sendMessageToTab(MessageType.ReservationResponse, {
              error: SIGNED_OUT_CTA_COPY,
              elementId,
            });
            await performDeauthSideEffects();
          };

          const clientState = await getBrowserStorageValue('clientState');
          if (clientState === undefined) {
            await deauthCallback();
            break;
          }

          const client = new ICloudClient(
            clientState.setupUrl,
            clientState.webservices
          );
          const isClientAuthenticated = await client.isAuthenticated();
          if (!isClientAuthenticated) {
            await deauthCallback();
            break;
          }

          try {
            const pms = new PremiumMailSettings(client);
            await pms.reserveHme(hme, label);
            await sendMessageToTab(MessageType.ReservationResponse, {
              hme,
              elementId,
            });
          } catch (e) {
            await sendMessageToTab(MessageType.ReservationResponse, {
              error: formatError(e),
              elementId,
            });
          }
        }
        break;
      default:
        break;
    }
  });
};
