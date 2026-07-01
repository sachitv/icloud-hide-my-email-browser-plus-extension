/**
 * In-memory mock implementation of HmeService.
 *
 * Mimics the real PremiumMailSettings API with realistic fake data and
 * simulated network latency. Enabled via the "Demo mode" toggle in Options.
 * No network requests are made; state is held per popup session.
 */
import type { HmeEmail, HmeService, ListHmeResult } from './iCloudClient';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

let counter = 1;
const nextId = () => `mock-${Date.now()}-${counter++}`;

function makeMockEmail(
  overrides: Partial<HmeEmail> & Pick<HmeEmail, 'hme' | 'label'>
): HmeEmail {
  return {
    origin: 'ON_DEMAND',
    anonymousId: nextId(),
    domain: 'icloud.com',
    forwardToEmail: 'you@example.com',
    isActive: true,
    note: '',
    createTimestamp: Date.now(),
    recipientMailId: nextId(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Seed data — realistic-looking aliases shown on first load
// ---------------------------------------------------------------------------

const SEED_EMAILS: HmeEmail[] = [
  makeMockEmail({
    anonymousId: 'seed-1',
    hme: 'sparkling.river.42@privaterelay.appleid.com',
    label: 'github.com',
    note: 'Used for GitHub sign-ups',
    createTimestamp: Date.now() - 30 * 24 * 60 * 60 * 1000,
  }),
  makeMockEmail({
    anonymousId: 'seed-2',
    hme: 'quiet.forest.17@privaterelay.appleid.com',
    label: 'newsletter.example.com',
    note: 'Marketing emails only',
    createTimestamp: Date.now() - 20 * 24 * 60 * 60 * 1000,
  }),
  makeMockEmail({
    anonymousId: 'seed-3',
    hme: 'gentle.tide.88@privaterelay.appleid.com',
    label: 'shopping.example.com',
    note: '',
    createTimestamp: Date.now() - 10 * 24 * 60 * 60 * 1000,
  }),
  makeMockEmail({
    anonymousId: 'seed-4',
    hme: 'amber.cloud.55@privaterelay.appleid.com',
    label: 'old-service.example.com',
    note: 'Deactivated — service shut down',
    isActive: false,
    createTimestamp: Date.now() - 60 * 24 * 60 * 60 * 1000,
  }),
  makeMockEmail({
    anonymousId: 'seed-5',
    hme: 'silver.peak.03@privaterelay.appleid.com',
    label: 'travel.example.com',
    note: 'Booked a hotel once',
    createTimestamp: Date.now() - 5 * 24 * 60 * 60 * 1000,
  }),
];

// Word lists for generating plausible-looking aliases
const ADJECTIVES = [
  'blue',
  'golden',
  'silent',
  'swift',
  'bright',
  'velvet',
  'azure',
  'crisp',
  'frosty',
  'noble',
];
const NOUNS = [
  'maple',
  'stone',
  'harbor',
  'falcon',
  'cedar',
  'meadow',
  'canyon',
  'prism',
  'comet',
  'lantern',
];

const mockAliasIndexes = {
  adjective: 0,
  noun: 0,
  number: 10,
};

function generateAlias(): string {
  const adj = ADJECTIVES[mockAliasIndexes.adjective];
  const noun = NOUNS[mockAliasIndexes.noun];
  const num = mockAliasIndexes.number;
  mockAliasIndexes.adjective =
    (mockAliasIndexes.adjective + 1) % ADJECTIVES.length;
  mockAliasIndexes.noun = (mockAliasIndexes.noun + 3) % NOUNS.length;
  mockAliasIndexes.number = mockAliasIndexes.number === 99 ? 10 : num + 1;
  return `${adj}.${noun}.${num}@privaterelay.appleid.com`;
}

// ---------------------------------------------------------------------------
// MockPremiumMailSettings — implements HmeService
// ---------------------------------------------------------------------------

export class MockPremiumMailSettings implements HmeService {
  private emails: HmeEmail[] = structuredClone(SEED_EMAILS);
  private readonly forwardToEmails = ['you@example.com', 'backup@example.com'];
  private selectedForwardTo = 'you@example.com';

  async listHme(): Promise<ListHmeResult> {
    await delay(350);
    return {
      hmeEmails: [...this.emails],
      selectedForwardTo: this.selectedForwardTo,
      forwardToEmails: [...this.forwardToEmails],
    };
  }

  async generateHme(): Promise<string> {
    await delay(450);
    return generateAlias();
  }

  async reserveHme(
    hme: string,
    label: string,
    note?: string
  ): Promise<HmeEmail> {
    await delay(350);
    const entry = makeMockEmail({
      hme,
      label,
      note: note ?? 'Generated through the Hide My Email+ browser extension',
      forwardToEmail: this.selectedForwardTo,
    });
    this.emails.unshift(entry);
    return entry;
  }

  async updateHmeMetadata(
    anonymousId: string,
    label: string,
    note?: string
  ): Promise<void> {
    await delay(250);
    this.emails = this.emails.map((e) =>
      e.anonymousId === anonymousId ? { ...e, label, note: note ?? '' } : e
    );
  }

  async deactivateHme(anonymousId: string): Promise<void> {
    await delay(250);
    this.emails = this.emails.map((e) =>
      e.anonymousId === anonymousId ? { ...e, isActive: false } : e
    );
  }

  async reactivateHme(anonymousId: string): Promise<void> {
    await delay(250);
    this.emails = this.emails.map((e) =>
      e.anonymousId === anonymousId ? { ...e, isActive: true } : e
    );
  }

  async deleteHme(anonymousId: string): Promise<void> {
    await delay(300);
    this.emails = this.emails.filter((e) => e.anonymousId !== anonymousId);
  }

  async updateForwardToHme(forwardToEmail: string): Promise<void> {
    await delay(250);
    this.selectedForwardTo = forwardToEmail;
  }
}
