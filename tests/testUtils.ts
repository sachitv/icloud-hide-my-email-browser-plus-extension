/**
 * Shared test utilities and factories for iCloud Hide My Email tests
 */

/**
 * Creates common HME email test data
 */
export function createHmeEmailTestData(
  overrides: {
    anonymousId?: string;
    label?: string;
    hme?: string;
    note?: string;
    isActive?: boolean;
    createTimestamp?: number;
  } = {}
) {
  return {
    anonymousId: overrides.anonymousId ?? 'test-id',
    note: overrides.note ?? '',
    label: overrides.label ?? 'Test alias',
    hme: overrides.hme ?? 'test@example.com',
    forwardToEmail: 'forward@example.com',
    origin: 'ON_DEMAND' as const,
    isActive: overrides.isActive ?? true,
    domain: 'domain',
    createTimestamp: overrides.createTimestamp ?? Date.now(),
    recipientMailId: 'recipient',
  };
}

/**
 * Creates common client state test data
 */
export function createClientStateTestData(
  overrides: {
    setupUrl?: string;
    serviceUrl?: string;
    webservices?: Record<string, { url: string; status: string }>;
  } = {}
) {
  return {
    setupUrl: overrides.setupUrl ?? 'https://setup.example.com',
    webservices: overrides.webservices ?? {
      premiummailsettings: {
        url: overrides.serviceUrl ?? 'https://service.example.com',
        status: 'active',
      },
    },
  };
}

/**
 * Creates multiple HME email test data entries for list scenarios
 */
export function createHmeEmailList(
  count: number,
  baseTimestamp?: number
): ReturnType<typeof createHmeEmailTestData>[] {
  const now = baseTimestamp ?? Date.now();
  const labels = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];

  return Array.from({ length: count }, (_, i) =>
    createHmeEmailTestData({
      anonymousId: labels[i]?.toLowerCase() ?? `id-${i}`,
      label: `${labels[i] ?? `Item ${i}`} alias`,
      hme: `${labels[i]?.toLowerCase() ?? `item${i}`}@example.com`,
      createTimestamp: now - i * 1000,
      isActive: i % 2 === 0, // Alternate active/inactive
    })
  );
}
