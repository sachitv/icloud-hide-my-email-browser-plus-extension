import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockPremiumMailSettings } from '../src/mockClient';

vi.useFakeTimers();

describe('MockPremiumMailSettings', () => {
  let pms: MockPremiumMailSettings;

  beforeEach(() => {
    pms = new MockPremiumMailSettings();
  });

  it('listHme returns the 5 seed aliases', async () => {
    const promise = pms.listHme();
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.hmeEmails).toHaveLength(5);
    expect(result.selectedForwardTo).toBe('you@example.com');
    expect(result.forwardToEmails).toContain('you@example.com');
  });

  it('generateHme returns a plausible alias string', async () => {
    const promise = pms.generateHme();
    await vi.runAllTimersAsync();
    const alias = await promise;
    expect(alias).toMatch(/@privaterelay\.appleid\.com$/);
  });

  it('cycles generated alias numbers after 99', async () => {
    const aliases: string[] = [];

    for (let i = 0; i < 100; i += 1) {
      const promise = pms.generateHme();
      await vi.runAllTimersAsync();
      aliases.push(await promise);
    }

    expect(
      aliases.some((alias) => alias.endsWith('.10@privaterelay.appleid.com'))
    ).toBe(true);
  });

  it('reserveHme adds the alias to the list and returns the HmeEmail', async () => {
    const reservePromise = pms.reserveHme(
      'new@privaterelay.appleid.com',
      'test.com',
      'a note'
    );
    await vi.runAllTimersAsync();
    const reserved = await reservePromise;

    expect(reserved.hme).toBe('new@privaterelay.appleid.com');
    expect(reserved.label).toBe('test.com');
    expect(reserved.note).toBe('a note');
    expect(reserved.isActive).toBe(true);

    const listPromise = pms.listHme();
    await vi.runAllTimersAsync();
    const result = await listPromise;
    expect(
      result.hmeEmails.some((e) => e.hme === 'new@privaterelay.appleid.com')
    ).toBe(true);
  });

  it('reserveHme uses default note when none provided', async () => {
    const promise = pms.reserveHme('x@privaterelay.appleid.com', 'x.com');
    await vi.runAllTimersAsync();
    const reserved = await promise;
    expect(reserved.note).toMatch(/Hide My Email/);
  });

  it('deactivateHme marks the alias as inactive', async () => {
    const listPromise = pms.listHme();
    await vi.runAllTimersAsync();
    const { hmeEmails } = await listPromise;
    const target = hmeEmails.find((e) => e.isActive);
    expect(target).toBeDefined();

    const deactivatePromise = pms.deactivateHme(target!.anonymousId);
    await vi.runAllTimersAsync();
    await deactivatePromise;

    const listPromise2 = pms.listHme();
    await vi.runAllTimersAsync();
    const updated = await listPromise2;
    expect(
      updated.hmeEmails.find((e) => e.anonymousId === target!.anonymousId)
        ?.isActive
    ).toBe(false);
  });

  it('reactivateHme marks a previously inactive alias as active', async () => {
    const listPromise = pms.listHme();
    await vi.runAllTimersAsync();
    const { hmeEmails } = await listPromise;
    const target = hmeEmails.find((e) => !e.isActive);
    expect(target).toBeDefined();

    const reactivatePromise = pms.reactivateHme(target!.anonymousId);
    await vi.runAllTimersAsync();
    await reactivatePromise;

    const listPromise2 = pms.listHme();
    await vi.runAllTimersAsync();
    const updated = await listPromise2;
    expect(
      updated.hmeEmails.find((e) => e.anonymousId === target!.anonymousId)
        ?.isActive
    ).toBe(true);
  });

  it('deleteHme removes the alias from the list', async () => {
    const listPromise = pms.listHme();
    await vi.runAllTimersAsync();
    const { hmeEmails } = await listPromise;
    const target = hmeEmails[0];

    const deletePromise = pms.deleteHme(target.anonymousId);
    await vi.runAllTimersAsync();
    await deletePromise;

    const listPromise2 = pms.listHme();
    await vi.runAllTimersAsync();
    const updated = await listPromise2;
    expect(
      updated.hmeEmails.find((e) => e.anonymousId === target.anonymousId)
    ).toBeUndefined();
    expect(updated.hmeEmails).toHaveLength(4);
  });

  it('updateHmeMetadata updates label and note', async () => {
    const listPromise = pms.listHme();
    await vi.runAllTimersAsync();
    const { hmeEmails } = await listPromise;
    const target = hmeEmails[0];

    const updatePromise = pms.updateHmeMetadata(
      target.anonymousId,
      'New Label',
      'New Note'
    );
    await vi.runAllTimersAsync();
    await updatePromise;

    const listPromise2 = pms.listHme();
    await vi.runAllTimersAsync();
    const updated = await listPromise2;
    const updatedEmail = updated.hmeEmails.find(
      (e) => e.anonymousId === target.anonymousId
    );
    expect(updatedEmail?.label).toBe('New Label');
    expect(updatedEmail?.note).toBe('New Note');
  });

  it('updateHmeMetadata clears note when undefined', async () => {
    const listPromise = pms.listHme();
    await vi.runAllTimersAsync();
    const { hmeEmails } = await listPromise;
    const target = hmeEmails[0];

    const updatePromise = pms.updateHmeMetadata(target.anonymousId, 'Label');
    await vi.runAllTimersAsync();
    await updatePromise;

    const listPromise2 = pms.listHme();
    await vi.runAllTimersAsync();
    const updated = await listPromise2;
    const updatedEmail = updated.hmeEmails.find(
      (e) => e.anonymousId === target.anonymousId
    );
    expect(updatedEmail?.note).toBe('');
  });

  it('updateForwardToHme changes the selected forward-to address', async () => {
    const updatePromise = pms.updateForwardToHme('backup@example.com');
    await vi.runAllTimersAsync();
    await updatePromise;

    const listPromise = pms.listHme();
    await vi.runAllTimersAsync();
    const result = await listPromise;
    expect(result.selectedForwardTo).toBe('backup@example.com');
  });
});
