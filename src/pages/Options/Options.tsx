import React, { useState, useEffect } from 'react';
import './Options.css';
import { useBrowserStorageState } from '../../hooks';
import ICloudClient, {
  PremiumMailSettings,
  type HmeService,
} from '../../iCloudClient';
import { MockPremiumMailSettings } from '../../mockClient';
import {
  Spinner,
  LoadingButton,
  ErrorMessage,
  TitledComponent,
  Link,
} from '../../commonComponents';
import { DEFAULT_STORE } from '../../storage';
import { startCase } from '../../utils/startCase';
import { deepEqual } from '../../utils/deepEqual';
import { formatError } from '../../utils/formatError';

const SELECT_FWD_TO_SIGNED_OUT_CTA_COPY =
  'To select a new Forward-To address, you first need to sign in by following the instructions on the extension pop-up.';

const SelectFwdToForm = ({ pms }: { pms: HmeService | null }) => {
  const [selectedFwdToEmail, setSelectedFwdToEmail] = useState<string>();
  const [fwdToEmails, setFwdToEmails] = useState<string[]>();
  const [isFetching, setIsFetching] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listHmeError, setListHmeError] = useState<string>();
  const [updateFwdToError, setUpdateFwdToError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    const fetchHmeList = async () => {
      setListHmeError(undefined);
      setIsFetching(true);

      if (pms === null) {
        /* v8 ignore next */
        if (!cancelled) {
          setListHmeError(SELECT_FWD_TO_SIGNED_OUT_CTA_COPY);
          setIsFetching(false);
        }
        return;
      }

      try {
        const result = await pms.listHme();
        /* v8 ignore next */
        if (cancelled) return;
        setFwdToEmails((prevState) =>
          deepEqual(prevState, result.forwardToEmails)
            ? prevState
            : result.forwardToEmails
        );
        setSelectedFwdToEmail(result.selectedForwardTo);
      } catch (e) {
        /* v8 ignore next */
        if (!cancelled) setListHmeError(formatError(e));
      } finally {
        /* v8 ignore next */
        if (!cancelled) setIsFetching(false);
      }
    };

    fetchHmeList();
    return () => {
      cancelled = true;
    };
  }, [pms]);

  const onSelectedFwdToSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setIsSubmitting(true);
    /* v8 ignore next */
    if (pms !== null) {
      if (selectedFwdToEmail) {
        try {
          await pms.updateForwardToHme(selectedFwdToEmail);
        } catch (e) {
          setUpdateFwdToError(formatError(e));
        }
      } else {
        setUpdateFwdToError('No Forward To address has been selected.');
      }
    }
    setIsSubmitting(false);
  };

  if (isFetching) {
    return <Spinner />;
  }

  if (listHmeError !== undefined) {
    return <ErrorMessage>{listHmeError}</ErrorMessage>;
  }

  return (
    <form className="space-y-4" onSubmit={onSelectedFwdToSubmit}>
      {fwdToEmails?.map((fwdToEmail) => {
        const encodedEmail = encodeURIComponent(fwdToEmail);
        const inputId = `fwdto-radio-${encodedEmail}`;

        return (
          <div
            className="flex items-center gap-3 rounded-2xl border border-slate-800/60 bg-slate-950/50 px-4 py-3 shadow-inner shadow-slate-900/30"
            key={fwdToEmail}
          >
            <input
              onChange={() => setSelectedFwdToEmail(fwdToEmail)}
              checked={fwdToEmail === selectedFwdToEmail}
              id={inputId}
              type="radio"
              disabled={isSubmitting}
              name="forward-to-email"
              className="h-4 w-4 cursor-pointer accent-rainbow-purple"
            />
            <label
              htmlFor={inputId}
              className="cursor-pointer text-sm font-medium text-slate-100"
            >
              {fwdToEmail}
            </label>
          </div>
        );
      })}
      <LoadingButton loading={isSubmitting}>Update forwarding</LoadingButton>
      {updateFwdToError && <ErrorMessage>{updateFwdToError}</ErrorMessage>}
    </form>
  );
};

const Disclaimer = () => {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-200/90">
      <p>
        This extension is not endorsed by, directly affiliated with, maintained,
        authorized, or sponsored by Apple.
      </p>
      <p className="text-center">
        Made by <Link href="https://sachit.me">Sachit Vithaldas</Link>.
      </p>
      <p className="text-center">
        The source code is available on{' '}
        <Link href="https://github.com/sachitv/icloud-hide-my-email-browser-plus-extension">
          Github
        </Link>
        .
      </p>
      <p>
        The extension itself is licensed under the same license as the source
        code.
      </p>
    </div>
  );
};

const AutofillForm = () => {
  const [options, setOptions] = useBrowserStorageState(
    'iCloudHmeOptions',
    DEFAULT_STORE.iCloudHmeOptions
  );

  return (
    <form className="space-y-3">
      {Object.entries(options.autofill).map(([key, value]) => (
        <div
          className="flex items-center gap-3 rounded-2xl border border-slate-800/60 bg-slate-950/50 px-4 py-3 shadow-inner shadow-slate-900/25"
          key={key}
        >
          <input
            onChange={() =>
              setOptions({
                ...options,
                autofill: { ...options.autofill, [key]: !value },
              })
            }
            checked={value}
            id={`checkbox-${key}`}
            type="checkbox"
            name={`checkbox-${key}`}
            className="h-4 w-4 cursor-pointer accent-rainbow-green"
          />
          <label
            htmlFor={`checkbox-${key}`}
            className="cursor-pointer text-sm font-medium text-slate-100"
          >
            {startCase(key)}
          </label>
        </div>
      ))}
    </form>
  );
};

const Options = () => {
  const [mockMode, setMockMode] = useBrowserStorageState(
    'mockMode',
    DEFAULT_STORE.mockMode
  );

  const [clientState, , isClientStateLoading] = useBrowserStorageState(
    'clientState',
    undefined
  );

  // Holds the verified-authenticated service instance (null = not authenticated or loading).
  const [pms, setPms] = useState<HmeService | null>(null);

  useEffect(() => {
    // In mock mode, skip auth entirely.
    if (mockMode) {
      setPms(new MockPremiumMailSettings());
      return;
    }

    if (isClientStateLoading || clientState?.setupUrl === undefined) {
      setPms(null);
      return;
    }

    let cancelled = false;
    const client = new ICloudClient(
      clientState.setupUrl,
      clientState.webservices
    );
    client.isAuthenticated().then((authenticated) => {
      /* v8 ignore next */
      if (cancelled) return;
      setPms(authenticated ? new PremiumMailSettings(client) : null);
    });

    return () => {
      cancelled = true;
    };
  }, [
    mockMode,
    clientState?.setupUrl,
    clientState?.webservices,
    isClientStateLoading,
  ]);

  return (
    <div className="min-h-screen px-4 py-10 text-slate-100">
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <TitledComponent title="Control Center" subtitle="Tune your experience">
          {mockMode && (
            <output
              aria-label="Demo mode active"
              className="flex items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300"
            >
              Demo mode active — no real iCloud data
            </output>
          )}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">Disclaimer</h3>
            <Disclaimer />
          </div>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">
              Forward To Address
            </h3>
            <SelectFwdToForm pms={pms} />
          </div>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">Autofill</h3>
            <AutofillForm />
          </div>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">Developer</h3>
            <p className="text-sm leading-relaxed text-slate-400">
              Enable Demo mode to explore the extension with realistic fake data
              — no iCloud sign-in required. Useful for testing and UI
              development.
            </p>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-800/60 bg-slate-950/50 px-4 py-3 shadow-inner shadow-slate-900/25">
              <input
                onChange={() => setMockMode(!mockMode)}
                checked={!!mockMode}
                id="checkbox-mock-mode"
                type="checkbox"
                name="checkbox-mock-mode"
                className="h-4 w-4 cursor-pointer accent-rainbow-green"
              />
              <label
                htmlFor="checkbox-mock-mode"
                className="cursor-pointer text-sm font-medium text-slate-100"
              >
                Demo mode
              </label>
            </div>
          </div>
        </TitledComponent>
      </div>
    </div>
  );
};

export default Options;
