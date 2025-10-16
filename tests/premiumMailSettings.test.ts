import { afterEach, describe, expect, it, vi } from 'vitest';
import ICloudClient, {
  GenerateHmeException,
  PremiumMailSettings,
  ReserveHmeException,
  UpdateHmeMetadataException,
  DeactivateHmeException,
  ReactivateHmeException,
  DeleteHmeException,
  UpdateFwdToHmeException,
  DEFAULT_RESERVATION_NOTE,
} from '../src/iCloudClient';

describe('PremiumMailSettings', () => {
  const createClient = () =>
    new ICloudClient('https://setup.example.com', {
      premiummailsettings: {
        url: 'https://icloud.example.com',
        status: 'active',
      },
    });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists HME aliases using the v2 endpoint', async () => {
    const client = createClient();
    const listResponse = {
      result: {
        hmeEmails: [],
        selectedForwardTo: 'user@example.com',
        forwardToEmails: ['user@example.com'],
      },
      success: true,
    };
    client.request = vi.fn().mockResolvedValue(listResponse);

    const settings = new PremiumMailSettings(client);
    const result = await settings.listHme();

    expect(client.request).toHaveBeenCalledWith(
      'GET',
      'https://icloud.example.com/v2/hme/list'
    );
    expect(result).toEqual(listResponse.result);
  });

  it('returns generated alias when request succeeds', async () => {
    const client = createClient();
    client.request = vi.fn().mockResolvedValue({
      success: true,
      result: { hme: 'alias@example.com' },
    });

    const settings = new PremiumMailSettings(client);
    const result = await settings.generateHme();

    expect(client.request).toHaveBeenCalledWith(
      'POST',
      'https://icloud.example.com/v1/hme/generate'
    );
    expect(result).toBe('alias@example.com');
  });

  it('throws GenerateHmeException when generation fails', async () => {
    const client = createClient();
    client.request = vi.fn().mockResolvedValue({
      success: false,
      error: { errorMessage: 'no quota' },
    });

    const settings = new PremiumMailSettings(client);

    await expect(settings.generateHme()).rejects.toThrowError(
      GenerateHmeException
    );
  });

  it('reserves generated alias and returns the HME payload', async () => {
    const client = createClient();
    const aliasPayload = {
      anonymousId: '123',
      hme: 'alias@example.com',
      origin: 'ON_DEMAND' as const,
      domain: 'icloud.com',
      forwardToEmail: 'user@example.com',
      isActive: true,
      label: 'Label',
      note: 'Note',
      createTimestamp: Date.now(),
      recipientMailId: 'abc',
    };
    client.request = vi.fn().mockResolvedValue({
      success: true,
      result: { hme: aliasPayload },
    });

    const settings = new PremiumMailSettings(client);
    const result = await settings.reserveHme(
      'alias@example.com',
      'Label',
      'Note'
    );

    expect(client.request).toHaveBeenCalledWith(
      'POST',
      'https://icloud.example.com/v1/hme/reserve',
      {
        data: { hme: 'alias@example.com', label: 'Label', note: 'Note' },
      }
    );
    expect(result).toEqual(aliasPayload);
  });

  it('uses the default note when one is not provided during reservation', async () => {
    const client = createClient();
    client.request = vi.fn().mockResolvedValue({
      success: true,
      result: {
        hme: {
          anonymousId: '123',
          hme: 'alias@example.com',
          origin: 'ON_DEMAND',
          domain: 'icloud.com',
          forwardToEmail: 'user@example.com',
          isActive: true,
          label: 'Label',
          note: DEFAULT_RESERVATION_NOTE,
          createTimestamp: 0,
          recipientMailId: 'abc',
        },
      },
    });

    const settings = new PremiumMailSettings(client);
    await settings.reserveHme('alias@example.com', 'Label');

    expect(client.request).toHaveBeenCalledWith(
      'POST',
      'https://icloud.example.com/v1/hme/reserve',
      {
        data: {
          hme: 'alias@example.com',
          label: 'Label',
          note: DEFAULT_RESERVATION_NOTE,
        },
      }
    );
  });

  it('throws ReserveHmeException when reservation fails', async () => {
    const client = createClient();
    client.request = vi.fn().mockResolvedValue({ success: false, error: {} });

    const settings = new PremiumMailSettings(client);
    await expect(
      settings.reserveHme('alias@example.com', 'Label', 'Note')
    ).rejects.toBeInstanceOf(ReserveHmeException);
  });

  it('updates metadata when the service reports success', async () => {
    const client = createClient();
    client.request = vi.fn().mockResolvedValue({ success: true, result: {} });

    const settings = new PremiumMailSettings(client);
    await settings.updateHmeMetadata('anon-123', 'New Label', 'New Note');

    expect(client.request).toHaveBeenCalledWith(
      'POST',
      'https://icloud.example.com/v1/hme/updateMetaData',
      {
        data: { anonymousId: 'anon-123', label: 'New Label', note: 'New Note' },
      }
    );
  });

  it('throws UpdateHmeMetadataException when metadata update fails', async () => {
    const client = createClient();
    client.request = vi.fn().mockResolvedValue({ success: false });

    const settings = new PremiumMailSettings(client);
    await expect(
      settings.updateHmeMetadata('anon-123', 'Label', 'Note')
    ).rejects.toBeInstanceOf(UpdateHmeMetadataException);
  });

  it('deactivates, reactivates, deletes, and updates forwarding when successful', async () => {
    const client = createClient();
    const successResponse = { success: true };
    const requestSpy = vi.fn().mockResolvedValue(successResponse);
    client.request = requestSpy;

    const settings = new PremiumMailSettings(client);
    await settings.deactivateHme('anon-123');
    await settings.reactivateHme('anon-123');
    await settings.deleteHme('anon-123');
    await settings.updateForwardToHme('user@example.com');

    expect(requestSpy).toHaveBeenNthCalledWith(
      1,
      'POST',
      'https://icloud.example.com/v1/hme/deactivate',
      { data: { anonymousId: 'anon-123' } }
    );
    expect(requestSpy).toHaveBeenNthCalledWith(
      2,
      'POST',
      'https://icloud.example.com/v1/hme/reactivate',
      { data: { anonymousId: 'anon-123' } }
    );
    expect(requestSpy).toHaveBeenNthCalledWith(
      3,
      'POST',
      'https://icloud.example.com/v1/hme/delete',
      { data: { anonymousId: 'anon-123' } }
    );
    expect(requestSpy).toHaveBeenNthCalledWith(
      4,
      'POST',
      'https://icloud.example.com/v1/hme/updateForwardTo',
      { data: { forwardToEmail: 'user@example.com' } }
    );
  });

  it('throws specific exceptions when operations fail', async () => {
    const client = createClient();
    const failingRequest = vi.fn().mockResolvedValue({ success: false });
    client.request = failingRequest;

    const settings = new PremiumMailSettings(client);

    await expect(settings.deactivateHme('anon-123')).rejects.toBeInstanceOf(
      DeactivateHmeException
    );
    await expect(settings.reactivateHme('anon-123')).rejects.toBeInstanceOf(
      ReactivateHmeException
    );
    await expect(settings.deleteHme('anon-123')).rejects.toBeInstanceOf(
      DeleteHmeException
    );
    await expect(
      settings.updateForwardToHme('user@example.com')
    ).rejects.toBeInstanceOf(UpdateFwdToHmeException);
  });
});
