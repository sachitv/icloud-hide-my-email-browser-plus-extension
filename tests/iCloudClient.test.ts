import { afterEach, describe, expect, it, vi } from 'vitest';
import ICloudClient, {
  CN_SETUP_URL,
  DEFAULT_SETUP_URL,
  UnsuccessfulRequestError,
} from '../src/iCloudClient';

describe('ICloudClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends requests with the provided configuration and returns parsed JSON', async () => {
    const responsePayload = { success: true };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(responsePayload),
    } as unknown as Response);

    const client = new ICloudClient(DEFAULT_SETUP_URL);

    const result = await client.request('POST', 'https://example.com', {
      headers: { 'Content-Type': 'application/json' },
      data: { foo: 'bar' },
    });

    expect(fetchSpy).toHaveBeenCalledWith('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foo: 'bar' }),
    });
    expect(result).toEqual(responsePayload);
  });

  it('throws UnsuccessfulRequestError when the response is not ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn(),
    } as unknown as Response);

    const client = new ICloudClient(CN_SETUP_URL);

    await expect(() =>
      client.request('GET', 'https://example.com')
    ).rejects.toBeInstanceOf(UnsuccessfulRequestError);
  });

  it('provides the webservice URL once webservices are initialised', () => {
    const client = new ICloudClient(DEFAULT_SETUP_URL, {
      premiummailsettings: { url: 'https://service.example.com', status: 'active' },
    });

    expect(client.webserviceUrl('premiummailsettings')).toBe(
      'https://service.example.com'
    );
  });

  it('throws when webserviceUrl is accessed before initialisation', () => {
    const client = new ICloudClient(DEFAULT_SETUP_URL);

    expect(() => client.webserviceUrl('premiummailsettings')).toThrow(
      /webservices have not been initialised/
    );
  });

  it('updates webservices when validateToken succeeds', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        webservices: {
          premiummailsettings: {
            url: 'https://service.example.com',
            status: 'active',
          },
        },
      }),
    } as unknown as Response);

    const client = new ICloudClient(DEFAULT_SETUP_URL);
    await client.validateToken();

    expect(fetchMock).toHaveBeenCalledWith(`${DEFAULT_SETUP_URL}/validate`, {
      method: 'POST',
      headers: {},
      body: undefined,
    });
    expect(client.webserviceUrl('premiummailsettings')).toBe(
      'https://service.example.com'
    );
  });

  it('returns true from isAuthenticated when validateToken resolves', async () => {
    const client = new ICloudClient(DEFAULT_SETUP_URL);
    client.validateToken = vi.fn().mockResolvedValue(undefined);

    await expect(client.isAuthenticated()).resolves.toBe(true);
    expect(client.validateToken).toHaveBeenCalled();
  });

  it('returns false from isAuthenticated when validateToken rejects', async () => {
    const client = new ICloudClient(DEFAULT_SETUP_URL);
    client.validateToken = vi.fn().mockRejectedValue(new Error('nope'));

    await expect(client.isAuthenticated()).resolves.toBe(false);
    expect(client.validateToken).toHaveBeenCalled();
  });

  it('calls the logout endpoint and swallows errors when signOut fails', async () => {
    const client = new ICloudClient(DEFAULT_SETUP_URL);
    client.request = vi.fn().mockRejectedValue(new Error('network down'));
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    await expect(client.signOut()).resolves.toBeUndefined();
    expect(client.request).toHaveBeenCalledWith('POST', `${DEFAULT_SETUP_URL}/logout`, {
      data: { trustBrowsers: false, allBrowsers: false },
    });
    expect(debugSpy).toHaveBeenCalled();
  });

  it('passes trust flag through signOut', async () => {
    const client = new ICloudClient(DEFAULT_SETUP_URL);
    const requestSpy = vi.fn().mockResolvedValue(undefined);
    client.request = requestSpy;

    await client.signOut({ trust: true });

    expect(requestSpy).toHaveBeenCalledWith('POST', `${DEFAULT_SETUP_URL}/logout`, {
      data: { trustBrowsers: true, allBrowsers: true },
    });
  });
});
