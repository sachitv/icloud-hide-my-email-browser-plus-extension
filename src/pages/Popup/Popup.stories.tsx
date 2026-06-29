/**
 * Storybook stories for the iCloud Hide My Email+ extension components.
 *
 * These stories use MockPremiumMailSettings to render realistic UI states
 * without requiring an iCloud session. Since the main popup components are
 * tightly coupled with browser extension APIs, these stories render
 * standalone wrappers that exercise the mock client directly.
 */
import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect, useState } from 'react';
import { MockPremiumMailSettings } from '../mockClient';
import type { HmeEmail, ListHmeResult } from '../iCloudClient';
import '../pages/Popup/index.css';

// ---------------------------------------------------------------------------
// HmeGenerator Story — shows the alias generation screen
// ---------------------------------------------------------------------------

const HmeGeneratorPreview = () => {
  const [pms] = useState(() => new MockPremiumMailSettings());
  const [generatedEmail, setGeneratedEmail] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    pms.generateHme().then((email) => {
      setGeneratedEmail(email);
      setIsLoading(false);
    });
  }, [pms]);

  const handleRefresh = async () => {
    setIsLoading(true);
    const email = await pms.generateHme();
    setGeneratedEmail(email);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-md space-y-4 rounded-3xl border border-slate-800/80 bg-slate-950/50 p-6 shadow-inner shadow-slate-900/50">
        <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-center text-xs font-medium text-amber-300">
          🧪 Demo Mode — Using mock data
        </div>
        <h2 className="text-center text-xl font-bold text-white">
          Generate Hide My Email
        </h2>
        <div className="space-y-3 text-center">
          {isLoading ? (
            <div className="animate-pulse text-sm text-slate-400">
              Generating...
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-mono text-emerald-400">
              {generatedEmail}
            </div>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            ↻ Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// HmeManager Story — shows the alias list with search, sort, and details
// ---------------------------------------------------------------------------

const HmeManagerPreview = () => {
  const [pms] = useState(() => new MockPremiumMailSettings());
  const [emails, setEmails] = useState<HmeEmail[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    pms.listHme().then((result: ListHmeResult) => {
      setEmails(
        [...result.hmeEmails].sort(
          (a, b) => b.createTimestamp - a.createTimestamp
        )
      );
      setIsLoading(false);
    });
  }, [pms]);

  const selectedEmail = emails[selectedIdx];

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-center text-xs font-medium text-amber-300 mb-3">
          🧪 Demo Mode — Using mock data
        </div>
        {isLoading ? (
          <div className="text-center text-slate-400">Loading aliases...</div>
        ) : (
          <div
            className="flex rounded-3xl border border-slate-800/80 bg-slate-950/50 shadow-inner shadow-slate-900/50"
            style={{ height: 450 }}
          >
            <div className="w-[35%] shrink-0 overflow-y-auto rounded-l-3xl bg-slate-950/70 focus:outline-none">
              {emails.map((hme, idx) => {
                const isSelected = idx === selectedIdx;
                return (
                  <button
                    key={hme.anonymousId}
                    type="button"
                    onClick={() => setSelectedIdx(idx)}
                    className={`flex w-full items-center border-b border-slate-800/50 px-3 py-3 text-left text-sm font-medium transition ${
                      isSelected
                        ? 'bg-gradient-to-r from-[rgba(139,92,246,0.4)] via-[rgba(79,70,229,0.4)] to-[rgba(66,133,244,0.4)] text-white'
                        : 'bg-slate-950/40 text-slate-200 hover:bg-slate-900/80'
                    }`}
                  >
                    {!hme.isActive && (
                      <span className="mr-1 text-red-400">⊘</span>
                    )}
                    {hme.label}
                  </button>
                );
              })}
            </div>
            <div className="grow overflow-y-auto rounded-r-3xl border-l border-slate-800/60 bg-slate-950/80 p-4">
              {selectedEmail && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white">
                    {selectedEmail.label}
                  </h3>
                  <p className="font-mono text-sm text-indigo-300">
                    {selectedEmail.hme}
                  </p>
                  <div className="space-y-1 text-xs text-slate-400">
                    <p>
                      Status:{' '}
                      <span
                        className={
                          selectedEmail.isActive
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }
                      >
                        {selectedEmail.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </p>
                    <p>Forward to: {selectedEmail.forwardToEmail}</p>
                    {selectedEmail.note && <p>Note: {selectedEmail.note}</p>}
                    <p>
                      Created:{' '}
                      {new Date(
                        selectedEmail.createTimestamp
                      ).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Options Story — shows the options page developer section
// ---------------------------------------------------------------------------

const OptionsPreview = () => {
  const [mockMode, setMockMode] = useState(false);
  const [autofillButton, setAutofillButton] = useState(true);
  const [contextMenu, setContextMenu] = useState(true);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-lg space-y-6">
        <h1 className="text-2xl font-bold text-white">
          Hide My Email+ Options
        </h1>

        <section className="space-y-3 rounded-3xl border border-slate-800/60 bg-slate-900/40 p-5 shadow">
          <h3 className="text-lg font-semibold text-white">Autofill</h3>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={autofillButton}
              onChange={(e) => setAutofillButton(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-500"
            />
            <span className="text-sm text-slate-300">
              Show autofill button on email inputs
            </span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={contextMenu}
              onChange={(e) => setContextMenu(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-500"
            />
            <span className="text-sm text-slate-300">
              Add right-click context menu item
            </span>
          </label>
        </section>

        <section className="space-y-3 rounded-3xl border border-slate-800/60 bg-slate-900/40 p-5 shadow">
          <h3 className="text-lg font-semibold text-white">Developer</h3>
          <p className="text-sm leading-relaxed text-slate-400">
            Enable Demo mode to explore the extension with realistic fake data —
            no iCloud sign-in required. Useful for testing and UI development.
          </p>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-800/60 bg-slate-950/50 px-4 py-3 shadow-inner shadow-slate-900/25">
            <input
              type="checkbox"
              checked={mockMode}
              onChange={(e) => setMockMode(e.target.checked)}
              className="h-5 w-5 rounded border-slate-600 bg-slate-800 text-indigo-500"
              id="demo-mode-toggle"
            />
            <label
              htmlFor="demo-mode-toggle"
              className="text-sm font-medium text-slate-200 select-none cursor-pointer"
            >
              Enable Demo mode
            </label>
            {mockMode && (
              <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300">
                Active
              </span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Meta and story exports
// ---------------------------------------------------------------------------

const meta: Meta = {
  title: 'Hide My Email+',
};
export default meta;

export const Generator: StoryObj = {
  render: () => <HmeGeneratorPreview />,
  name: 'HmeGenerator (Authenticated)',
};

export const Manager: StoryObj = {
  render: () => <HmeManagerPreview />,
  name: 'HmeManager (Mock Aliases)',
};

export const Options: StoryObj = {
  render: () => <OptionsPreview />,
  name: 'Options Page',
};
