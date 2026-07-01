import React, {
  useState,
  Dispatch,
  useEffect,
  ButtonHTMLAttributes,
  DetailedHTMLProps,
  ReactNode,
  ReactElement,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import ICloudClient, {
  PremiumMailSettings,
  HmeEmail,
  type HmeService,
} from '../../iCloudClient';
import { MockPremiumMailSettings } from '../../mockClient';
import './Popup.css';
import { useBrowserStorageState } from '../../hooks';
import type { IconProps } from '../../icons';
import {
  RefreshIcon,
  ClipboardIcon,
  CheckIcon,
  ListIcon,
  SignOutIcon,
  PlusIcon,
  TrashIcon,
  BanIcon,
  SearchIcon,
  InfoCircleIcon,
  ExternalLinkIcon,
  QuestionCircleIcon,
  FirefoxIcon,
  EditIcon,
  XIcon,
  WarningIcon,
  SpinnerIcon,
} from '../../icons';
import { MessageType, sendMessageToTab } from '../../messages';
import {
  ErrorMessage,
  LoadingButton,
  Spinner,
  TitledComponent,
  Link,
} from '../../commonComponents';
import { Store, DEFAULT_STORE } from '../../storage';

import browser from 'webextension-polyfill';
import Fuse from 'fuse.js';
import { deepEqual } from '../../utils/deepEqual';
import { formatError } from '../../utils/formatError';
import {
  PopupAction,
  PopupState,
  AuthenticatedAction,
  STATE_MACHINE_TRANSITIONS,
  AuthenticatedAndManagingAction,
} from './stateMachine';
import { isFirefox } from '../../browserUtils';
import { performDeauthSideEffects } from '../Background/authSync';

type TransitionCallback<T extends PopupAction> = (action: T) => void;

const toggleActivationState =
  (target: HmeEmail) =>
  (candidate: HmeEmail): HmeEmail =>
    deepEqual(candidate, target)
      ? { ...candidate, isActive: !candidate.isActive }
      : candidate;

const createActivationUpdater =
  (target: HmeEmail) =>
  (existingEmails?: HmeEmail[]): HmeEmail[] | undefined =>
    existingEmails?.map(toggleActivationState(target));

const createDeletionUpdater =
  (target: HmeEmail) =>
  (existingEmails?: HmeEmail[]): HmeEmail[] | undefined =>
    existingEmails?.filter((candidate) => !deepEqual(candidate, target));

const createEditUpdater =
  (targetId: string, label: string, note: string) =>
  (existingEmails?: HmeEmail[]): HmeEmail[] | undefined =>
    existingEmails?.map((candidate) =>
      candidate.anonymousId === targetId
        ? { ...candidate, label, note }
        : candidate
    );

const SignInInstructions = () => {
  const userguideUrl = browser.runtime.getURL('userguide.html');

  return (
    <TitledComponent title="Hide My Email+" subtitle="Sign in to iCloud">
      <div className="space-y-6 text-slate-100">
        <div className="space-y-3 text-sm leading-relaxed text-slate-200/95">
          <p>
            To use this extension, sign in to your iCloud account on{' '}
            <Link href="https://icloud.com" aria-label="Go to iCloud.com">
              icloud.com
            </Link>{' '}
            . Complete the flow, including{' '}
            <span className="font-semibold text-white">
              two-factor authentication
            </span>
            {' and '}
            <span className="font-semibold text-white">Trust This Browser</span>
            .
          </p>
        </div>
        <div
          className="flex items-start gap-3 rounded-2xl border border-rainbow-blue/40 bg-rainbow-blue/10 px-4 py-3 text-sm text-slate-100"
          role="alert"
        >
          <InfoCircleIcon className="mt-1 h-5 w-5 text-rainbow-blue" />
          <div>
            <p className="font-semibold text-white">Pro tip</p>
            <p>
              Tick the{' '}
              <span className="font-semibold text-white">
                Keep me signed in
              </span>{' '}
              box so the extension stays connected.
            </p>
          </div>
        </div>
        {/* isFirefox is a module-level constant evaluated at import time.
             Its value cannot be changed per-test without a full module reset,
             so the true branch is untestable in the current test setup. */}
        {/* v8 ignore start */}
        {isFirefox && (
          <div
            className="flex items-start gap-3 rounded-2xl border border-rainbow-orange/50 bg-rainbow-orange/10 px-4 py-3 text-sm text-amber-100"
            role="alert"
          >
            <FirefoxIcon className="mt-1 h-5 w-5" />
            <div>
              If you use{' '}
              <Link
                href="https://support.mozilla.org/en-US/kb/containers"
                aria-label="Firefox Multi-Account Containers docs"
              >
                Firefox Containers
              </Link>
              , sign in to iCloud from a tab outside of any container.
            </div>
          </div>
        )}
        {/* v8 ignore stop */}
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={userguideUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#34a853] via-success to-[#4285f4] px-5 py-3 text-sm font-semibold text-slate-900 shadow-[0_18px_35px_-18px_rgba(52,211,153,0.7)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_46px_-18px_rgba(37,211,174,0.75)] focus:outline-none focus:ring-2 focus:ring-emerald-200/70"
            aria-label="Help"
          >
            <QuestionCircleIcon className="h-5 w-5" />
            Help
          </a>
          <a
            href="https://icloud.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-200 via-rose-200 to-pink-300 px-5 py-3 text-sm font-semibold text-slate-900 shadow-[0_18px_35px_-18px_rgba(249,168,212,0.75)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_46px_-18px_rgba(249,168,212,0.85)] focus:outline-none focus:ring-2 focus:ring-amber-200/70"
            aria-label="Go to iCloud.com"
          >
            <ExternalLinkIcon className="h-5 w-5" />
            Open icloud.com
          </a>
        </div>
      </div>
    </TitledComponent>
  );
};

const ReservationResult = (props: { hme: HmeEmail }) => {
  const reservedEmailFontSize = getGeneratedEmailFontSize(props.hme.hme);
  const onCopyToClipboardClick = async () => {
    await navigator.clipboard.writeText(props.hme.hme);
  };

  const onAutofillClick = async () => {
    await sendMessageToTab(MessageType.Autofill, props.hme.hme);
  };

  const btnClassName =
    'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_-16px_rgba(16,185,129,0.75)] transition hover:-translate-y-0.5 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200/80 focus:ring-offset-2 focus:ring-offset-slate-950';

  return (
    <div
      className="space-y-3 rounded-2xl border border-rainbow-green/40 bg-rainbow-green/10 p-4 text-sm text-emerald-50"
      role="alert"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200/90">
        Reserved address
      </p>
      <p
        title={props.hme.hme}
        className="whitespace-nowrap font-mono font-semibold leading-tight text-white"
        style={{ fontSize: reservedEmailFontSize }}
      >
        {props.hme.hme}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={btnClassName}
          onClick={onCopyToClipboardClick}
        >
          <ClipboardIcon className="mr-1 h-4 w-4" />
          Copy to clipboard
        </button>
        <button
          type="button"
          className={btnClassName}
          onClick={onAutofillClick}
        >
          <CheckIcon className="mr-1 h-4 w-4" />
          Autofill
        </button>
      </div>
    </div>
  );
};

function getGeneratedEmailFontSize(hmeEmail: string | undefined): string {
  const length = hmeEmail?.length ?? 0;
  if (length <= 24) {
    return '1.125rem';
  }
  if (length <= 30) {
    return '1rem';
  }
  if (length <= 36) {
    return '0.9rem';
  }
  return '0.82rem';
}

const FooterButton = (
  props: {
    label: string;
    icon: React.ComponentType<IconProps>;
  } & DetailedHTMLProps<
    ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  >
) => {
  const { label, icon, className, ...rest } = props;
  const baseClassName =
    'inline-flex items-center gap-2 rounded-full bg-slate-800/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500/70 focus:ring-offset-2 focus:ring-offset-slate-950';
  const composedClassName = [baseClassName, className]
    .filter(Boolean)
    .join(' ');
  const Icon = icon;
  return (
    <button className={composedClassName} {...rest}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
};

const SignOutButton = (props: {
  callback: TransitionCallback<'SIGN_OUT'>;
  client: ICloudClient;
  setClientState: Dispatch<Store['clientState']>;
}) => {
  return (
    <FooterButton
      className="bg-transparent text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 focus:ring-rose-300/60"
      onClick={async () => {
        await props.client.signOut();
        props.setClientState(() => undefined);
        await performDeauthSideEffects();
        props.callback('SIGN_OUT');
      }}
      label="Sign out"
      icon={SignOutIcon}
    />
  );
};

const ReservationForm = ({
  isReservationFormDisabled,
  onUseSubmit,
  tabHost,
  label,
  setLabel,
  reservationFormInputClassName,
  note,
  setNote,
  isUseSubmitting,
  reserveError,
}: {
  isReservationFormDisabled: boolean;
  onUseSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  tabHost: string;
  label: string | undefined;
  setLabel: (value: string) => void;
  reservationFormInputClassName: string;
  note: string | undefined;
  setNote: (value: string) => void;
  isUseSubmitting: boolean;
  reserveError: string | undefined;
}) => (
  <form
    className={`space-y-4 rounded-3xl border border-slate-800/70 bg-slate-950/50 p-4 shadow-inner shadow-slate-900/40 transition ${
      isReservationFormDisabled ? 'opacity-60' : ''
    }`}
    onSubmit={onUseSubmit}
  >
    <div className="space-y-2">
      <label
        htmlFor="label"
        className="block text-xs font-semibold uppercase tracking-[0.32em] text-slate-400"
      >
        Label
      </label>
      <input
        id="label"
        placeholder={tabHost}
        required
        value={label || ''}
        onChange={(e) => setLabel(e.target.value)}
        className={reservationFormInputClassName}
        disabled={isReservationFormDisabled}
      />
    </div>
    <div className="space-y-2">
      <label
        htmlFor="note"
        className="block text-xs font-semibold uppercase tracking-[0.32em] text-slate-400"
      >
        Note
      </label>
      <textarea
        id="note"
        rows={2}
        className={reservationFormInputClassName}
        placeholder="Add a short reminder (optional)"
        value={note || ''}
        onChange={(e) => setNote(e.target.value)}
        disabled={isReservationFormDisabled}
      ></textarea>
    </div>
    <LoadingButton
      loading={isUseSubmitting}
      disabled={isReservationFormDisabled}
    >
      Use this email
    </LoadingButton>
    {reserveError && <ErrorMessage>{reserveError}</ErrorMessage>}
  </form>
);

const MockModeBanner = () => (
  <output
    aria-label="Demo mode active"
    className="flex items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300"
  >
    Demo mode — no real iCloud data
  </output>
);

const HmeGenerator = (props: {
  callback: TransitionCallback<AuthenticatedAction>;
  pms: HmeService;
  client: ICloudClient | null;
  setClientState: Dispatch<Store['clientState']>;
  mockMode: boolean;
}) => {
  const [hmeEmail, setHmeEmail] = useState<string>();
  const [hmeError, setHmeError] = useState<string>();

  const [reservedHme, setReservedHme] = useState<HmeEmail>();
  const [reserveError, setReserveError] = useState<string>();

  const [isEmailRefreshSubmitting, setIsEmailRefreshSubmitting] =
    useState(false);
  const [isUseSubmitting, setIsUseSubmitting] = useState(false);
  const [tabHost, setTabHost] = useState('');
  const [fwdToEmail, setFwdToEmail] = useState<string>();
  const [allHmeEmails, setAllHmeEmails] = useState<HmeEmail[]>([]);
  const allHmeEmailsRef = useRef<HmeEmail[]>([]);
  const [, setCachedHmeList] = useBrowserStorageState(
    'cachedHmeList',
    undefined
  );
  const [dismissedDomainWarning, setDismissedDomainWarning] = useState(false);
  const [copiedExistingAlias, setCopiedExistingAlias] = useState<string>();

  const [note, setNote] = useState<string>();
  const [label, setLabel] = useState<string>();

  const existingAliasesForDomain = useMemo(
    () =>
      tabHost
        ? allHmeEmails.filter(
            (e) => e.isActive && e.label.toLowerCase() === tabHost.toLowerCase()
          )
        : [],
    [allHmeEmails, tabHost]
  );
  const generatedEmailFontSize = getGeneratedEmailFontSize(hmeEmail);

  useEffect(() => {
    const fetchHmeList = async () => {
      setHmeError(undefined);
      try {
        const result = await props.pms.listHme();
        setFwdToEmail(result.selectedForwardTo);
        allHmeEmailsRef.current = result.hmeEmails;
        setAllHmeEmails(result.hmeEmails);
      } catch (e) {
        setHmeError(formatError(e));
      }
    };

    fetchHmeList();
  }, [props.pms]);

  useEffect(() => {
    const fetchHmeEmail = async () => {
      setHmeError(undefined);
      setIsEmailRefreshSubmitting(true);
      try {
        setHmeEmail(await props.pms.generateHme());
      } catch (e) {
        setHmeError(formatError(e));
      } finally {
        setIsEmailRefreshSubmitting(false);
      }
    };

    fetchHmeEmail();
  }, [props.pms]);

  useEffect(() => {
    const getTabHost = async () => {
      const [tab] = await browser.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      const tabUrl = tab?.url;
      if (tabUrl !== undefined) {
        const { hostname } = new URL(tabUrl);
        setTabHost(hostname);
        setLabel(hostname);
      }
    };

    getTabHost().catch(console.error);
  }, []);

  const onEmailRefreshClick = async () => {
    setIsEmailRefreshSubmitting(true);
    setReservedHme(undefined);
    setHmeError(undefined);
    setReserveError(undefined);
    try {
      setHmeEmail(await props.pms.generateHme());
    } catch (e) {
      setHmeError(formatError(e));
    }
    setIsEmailRefreshSubmitting(false);
  };

  const onUseSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsUseSubmitting(true);
    setReservedHme(undefined);
    setReserveError(undefined);

    // ReservationForm only renders when hmeEmail is truthy, so onUseSubmit
    // can only fire when hmeEmail is already defined — the false branch is unreachable.
    /* v8 ignore start */
    if (hmeEmail !== undefined) {
      /* v8 ignore stop */
      try {
        const reserved = await props.pms.reserveHme(
          hmeEmail,
          label || tabHost,
          note || undefined
        );
        setReservedHme(reserved);
        const nextAllHmeEmails = allHmeEmailsRef.current.some(
          (e) => e.anonymousId === reserved.anonymousId
        )
          ? allHmeEmailsRef.current
          : [...allHmeEmailsRef.current, reserved];
        allHmeEmailsRef.current = nextAllHmeEmails;
        setAllHmeEmails((prev) =>
          prev.some((e) => e.anonymousId === reserved.anonymousId)
            ? prev
            : nextAllHmeEmails
        );
        setCachedHmeList((prev) => {
          if (!prev) {
            return {
              hmeEmails: nextAllHmeEmails,
              forwardToEmails: fwdToEmail ? [fwdToEmail] : [],
              selectedForwardTo: fwdToEmail || '',
            };
          }
          if (
            prev.hmeEmails.some((e) => e.anonymousId === reserved.anonymousId)
          ) {
            return prev;
          }
          return {
            ...prev,
            hmeEmails: [...prev.hmeEmails, reserved],
          };
        });
        setLabel(undefined);
        setNote(undefined);
      } catch (e) {
        setReserveError(formatError(e));
      }
    }
    setIsUseSubmitting(false);
  };

  const isReservationFormDisabled =
    isEmailRefreshSubmitting || hmeEmail === reservedHme?.hme;

  const reservationFormInputClassName =
    'w-full rounded-2xl border border-slate-800/70 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition focus:border-rainbow-purple focus:outline-none focus:ring-2 focus:ring-rainbow-purple/70';

  const onCopyExistingAlias = (hme: string) => {
    navigator.clipboard.writeText(hme).catch(
      /* v8 ignore next */
      () => undefined
    );
    setCopiedExistingAlias(hme);
    /* v8 ignore next */
    setTimeout(
      () => setCopiedExistingAlias((prev) => (prev === hme ? undefined : prev)),
      1500
    );
  };

  return (
    <TitledComponent hideHeader>
      <div className="space-y-5">
        {props.mockMode && <MockModeBanner />}
        {existingAliasesForDomain.length > 0 && !dismissedDomainWarning && (
          <div
            className="space-y-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100"
            role="alert"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-amber-200">
                <WarningIcon className="h-4 w-4 shrink-0" />
                Existing{' '}
                {existingAliasesForDomain.length === 1 ? 'alias' : 'aliases'}{' '}
                for this site
              </div>
              <button
                type="button"
                onClick={() => setDismissedDomainWarning(true)}
                className="shrink-0 text-amber-400 hover:text-amber-200"
                title="Dismiss"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            {existingAliasesForDomain.map((existing) => (
              <div
                key={existing.anonymousId}
                className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-900/20 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-xs font-mono text-amber-100">
                  {existing.hme}
                </span>
                <button
                  type="button"
                  onClick={() => onCopyExistingAlias(existing.hme)}
                  title={
                    copiedExistingAlias === existing.hme ? 'Copied!' : 'Copy'
                  }
                  className="shrink-0 rounded-lg p-1 text-amber-400 hover:text-amber-200"
                >
                  {copiedExistingAlias === existing.hme ? (
                    <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <ClipboardIcon className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="inline-flex w-full max-w-[360px] min-w-0 items-center gap-3 rounded-full border border-rainbow-purple/50 bg-slate-900/70 px-5 py-2 font-semibold text-white shadow-inner shadow-rainbow-purple/20">
            <button
              className="rounded-full bg-rainbow-purple/20 px-2 py-2 text-rainbow-purple transition hover:bg-rainbow-purple/40 focus:outline-none focus:ring-2 focus:ring-rainbow-purple/70"
              onClick={onEmailRefreshClick}
              aria-label="Refresh email"
            >
              <RefreshIcon
                className={`align-middle h-4 w-4 ${
                  isEmailRefreshSubmitting ? 'animate-spin' : ''
                }`}
              />
            </button>
            <span
              title={hmeEmail}
              className="min-w-0 flex-1 whitespace-nowrap text-left font-mono leading-tight"
              style={{ fontSize: generatedEmailFontSize }}
            >
              {hmeEmail}
            </span>
          </div>
          {fwdToEmail !== undefined && (
            <p className="text-sm text-slate-300">
              Forwarding to: {fwdToEmail}
            </p>
          )}
          {hmeError && <ErrorMessage>{hmeError}</ErrorMessage>}
        </div>
        {hmeEmail && (
          <div className="space-y-4">
            <ReservationForm
              isReservationFormDisabled={isReservationFormDisabled}
              onUseSubmit={onUseSubmit}
              tabHost={tabHost}
              label={label}
              setLabel={setLabel}
              reservationFormInputClassName={reservationFormInputClassName}
              note={note}
              setNote={setNote}
              isUseSubmitting={isUseSubmitting}
              reserveError={reserveError}
            />
            {reservedHme && <ReservationResult hme={reservedHme} />}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 pt-4">
        <div>
          <FooterButton
            onClick={() => props.callback('MANAGE')}
            icon={ListIcon}
            label="Manage emails"
            className="bg-slate-800/80 text-slate-200 hover:bg-slate-700"
          />
        </div>
        <div className="text-right">
          {props.client !== null && (
            <SignOutButton
              callback={props.callback}
              client={props.client}
              setClientState={props.setClientState}
            />
          )}
        </div>
      </div>
      <div className="pt-4 text-xs text-slate-400">
        <p className="text-center">
          Made by <Link href="https://sachit.me">Sachit Vithaldas</Link>.
        </p>
        <p className="text-center">
          The source code is available on{' '}
          <Link href="https://github.com/sachitv/icloud-hide-my-email-browser-plus-extension">
            GitHub
          </Link>
          .
        </p>
      </div>
    </TitledComponent>
  );
};

const HmeDetails = (props: {
  hme: HmeEmail;
  pms: HmeService;
  activationCallback: () => void;
  deletionCallback: () => void;
  editCallback: (label: string, note: string) => void;
}) => {
  const [isActivateSubmitting, setIsActivateSubmitting] = useState(false);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(props.hme.label);
  const [editNote, setEditNote] = useState(props.hme.note || '');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    setError(undefined);
    setIsActivateSubmitting(false);
    setIsDeleteSubmitting(false);
    setConfirmingDelete(false);
    setIsEditing(false);
    setEditLabel(props.hme.label);
    setEditNote(props.hme.note || '');
    setEditError(undefined);
  }, [props.hme]);

  const onActivationClick = async () => {
    setIsActivateSubmitting(true);
    try {
      if (props.hme.isActive) {
        await props.pms.deactivateHme(props.hme.anonymousId);
      } else {
        await props.pms.reactivateHme(props.hme.anonymousId);
      }
      props.activationCallback();
    } catch (e) {
      setError(formatError(e));
    } finally {
      setIsActivateSubmitting(false);
    }
  };

  const onDeletionClick = async () => {
    setIsDeleteSubmitting(true);
    try {
      await props.pms.deleteHme(props.hme.anonymousId);
      props.deletionCallback();
    } catch (e) {
      setError(formatError(e));
      setConfirmingDelete(false);
    } finally {
      setIsDeleteSubmitting(false);
    }
  };

  const onSaveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editLabel.trim()) {
      setEditError('Label cannot be empty.');
      return;
    }
    setIsSavingEdit(true);
    setEditError(undefined);
    try {
      await props.pms.updateHmeMetadata(
        props.hme.anonymousId,
        editLabel,
        editNote
      );
      props.editCallback(editLabel, editNote);
      setIsEditing(false);
    } catch (e) {
      setEditError(formatError(e));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const onCancelEdit = () => {
    setIsEditing(false);
    setEditLabel(props.hme.label);
    setEditNote(props.hme.note || '');
    setEditError(undefined);
  };

  const onCopyClick = async () => {
    await navigator.clipboard.writeText(props.hme.hme);
  };

  const onAutofillClick = async () => {
    await sendMessageToTab(MessageType.Autofill, props.hme.hme);
  };

  const buttonBaseClass =
    'inline-flex items-center justify-center gap-2 !rounded-xl !px-3 !py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950';
  const labelClassName =
    'text-xs font-semibold uppercase tracking-[0.24em] text-slate-400';
  const valueClassName =
    'mt-0.5 rounded-xl border border-slate-800/70 bg-slate-950/60 px-2.5 py-1.5 text-sm font-medium text-slate-100 truncate';
  const editInputClassName =
    'mt-0.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-100 placeholder-slate-500 transition focus:border-rainbow-purple focus:outline-none focus:ring-2 focus:ring-rainbow-purple/70';

  return (
    <div className="space-y-3 text-slate-100">
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        <div className="col-span-2">
          <p className={labelClassName}>Email</p>
          <p title={props.hme.hme} className={valueClassName}>
            {props.hme.isActive || (
              <BanIcon className="mr-2 inline h-4 w-4 text-rainbow-red" />
            )}
            {props.hme.hme}
          </p>
        </div>
        <div className="min-w-0">
          <p className={labelClassName}>Label</p>
          {isEditing ? (
            <input
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              className={editInputClassName}
              required
              // biome-ignore lint/a11y/noAutofocus: autofocus is intentional when entering edit mode
              autoFocus
            />
          ) : (
            <p title={props.hme.label} className={valueClassName}>
              {props.hme.label}
            </p>
          )}
        </div>
        <div className="min-w-0">
          <p className={labelClassName}>Created</p>
          <p className={valueClassName}>
            {new Date(props.hme.createTimestamp).toLocaleString()}
          </p>
        </div>
        <div className="col-span-2">
          <p className={labelClassName}>Forward to</p>
          <p title={props.hme.forwardToEmail} className={valueClassName}>
            {props.hme.forwardToEmail}
          </p>
        </div>
        <div className="col-span-2">
          <p className={labelClassName}>Note</p>
          {isEditing && (
            <textarea
              rows={2}
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Add a short reminder (optional)"
              className={editInputClassName}
            />
          )}
          {!isEditing && props.hme.note && (
            <p title={props.hme.note} className={valueClassName}>
              {props.hme.note}
            </p>
          )}
          {!isEditing && !props.hme.note && (
            <p className="mt-0.5 text-xs italic text-slate-500">None</p>
          )}
        </div>
      </div>
      {(error || editError) && (
        <ErrorMessage>{error || editError}</ErrorMessage>
      )}
      {isEditing ? (
        <form onSubmit={onSaveEdit} className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancelEdit}
            className={`${buttonBaseClass} bg-slate-800 text-slate-200 hover:bg-slate-700 focus:ring-slate-500`}
          >
            <XIcon className="h-4 w-4" /> Cancel
          </button>
          <LoadingButton
            className={`${buttonBaseClass} bg-indigo-500 text-white hover:bg-indigo-400 focus:ring-indigo-300`}
            loading={isSavingEdit}
          >
            <CheckIcon className="h-4 w-4" /> Save
          </LoadingButton>
        </form>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <button
            title="Copy"
            type="button"
            className={`${buttonBaseClass} bg-slate-800 text-white hover:bg-slate-700 focus:ring-slate-500`}
            onClick={onCopyClick}
          >
            <ClipboardIcon className="h-4 w-4" />
          </button>
          <button
            title="Autofill"
            type="button"
            className={`${buttonBaseClass} bg-emerald-500 text-white hover:bg-emerald-400 focus:ring-emerald-300`}
            onClick={onAutofillClick}
          >
            <CheckIcon className="h-4 w-4" />
          </button>
          <LoadingButton
            title={props.hme.isActive ? 'Deactivate' : 'Reactivate'}
            className={`${buttonBaseClass} ${
              props.hme.isActive
                ? 'bg-red-500 text-white hover:bg-red-400 focus:ring-red-300'
                : 'bg-indigo-500 text-white hover:bg-indigo-400 focus:ring-indigo-300'
            }`}
            onClick={onActivationClick}
            loading={isActivateSubmitting}
          >
            {props.hme.isActive ? (
              <BanIcon className="h-4 w-4" />
            ) : (
              <RefreshIcon className="h-4 w-4" />
            )}
          </LoadingButton>
          <button
            title="Edit label and note"
            type="button"
            className={`${buttonBaseClass} col-span-3 bg-slate-800/60 text-slate-300 hover:bg-slate-700 focus:ring-slate-500`}
            onClick={() => setIsEditing(true)}
          >
            <EditIcon className="h-4 w-4" /> Edit label &amp; note
          </button>
          {!props.hme.isActive &&
            (confirmingDelete ? (
              <div className="col-span-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className={`${buttonBaseClass} flex-1 bg-slate-800 text-slate-200 hover:bg-slate-700 focus:ring-slate-500`}
                >
                  <XIcon className="h-4 w-4" /> Cancel
                </button>
                <LoadingButton
                  className={`${buttonBaseClass} flex-1 bg-red-600 text-white hover:bg-red-500 focus:ring-red-400`}
                  onClick={onDeletionClick}
                  loading={isDeleteSubmitting}
                >
                  <TrashIcon className="h-4 w-4" /> Confirm delete
                </LoadingButton>
              </div>
            ) : (
              <button
                type="button"
                title="Delete"
                className={`${buttonBaseClass} col-span-3 bg-red-500/20 text-red-300 hover:bg-red-500/30 focus:ring-red-400`}
                onClick={() => setConfirmingDelete(true)}
              >
                <TrashIcon className="mr-1 h-4 w-4" /> Delete
              </button>
            ))}
        </div>
      )}
    </div>
  );
};

const searchHmeEmails = (
  searchPrompt: string,
  searchEngine: Fuse<HmeEmail>
): HmeEmail[] | undefined => {
  if (!searchPrompt) {
    return undefined;
  }

  const searchResults = searchEngine.search(searchPrompt);
  return searchResults.map((result) => result.item);
};

type HmeListViewProps = {
  pms: HmeService;
  fetchedHmeEmails: HmeEmail[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  searchPrompt?: string;
  onSearchPromptChange: (value: string) => void;
  activationCallbackFactory: (hmeEmail: HmeEmail) => () => void;
  deletionCallbackFactory: (hmeEmail: HmeEmail) => () => void;
  editCallbackFactory: (
    hmeEmail: HmeEmail
  ) => (label: string, note: string) => void;
  onBulkDeactivate: (ids: string[]) => void;
  onBulkDelete: (ids: string[]) => void;
};

const SearchBar = ({
  searchPrompt,
  onSearchPromptChange,
  sortBy,
  onSortByChange,
  onExportClick,
}: {
  searchPrompt: string | undefined;
  onSearchPromptChange: (value: string) => void;
  sortBy: SortBy;
  onSortByChange: (value: SortBy) => void;
  onExportClick: () => void;
}) => (
  <div className="space-y-2 rounded-tl-3xl border-b border-slate-800/60 bg-slate-950 p-3">
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 flex items-center pl-3">
        <SearchIcon className="h-4 w-4 text-slate-500" />
      </div>
      <input
        type="search"
        className="w-full rounded-2xl border border-slate-700 bg-slate-900 py-2 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/60"
        placeholder="Search"
        aria-label="Search through your Hide My Email+ aliases"
        defaultValue={searchPrompt ?? ''}
        onChange={(event) => onSearchPromptChange(event.target.value)}
      />
    </div>
    <div className="flex gap-2">
      <select
        aria-label="Sort aliases"
        value={sortBy}
        onChange={(event) => onSortByChange(parseSortBy(event.target.value))}
        className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="label">Label</option>
        <option value="active">Active</option>
      </select>
      <button
        type="button"
        onClick={onExportClick}
        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        Export
      </button>
    </div>
  </div>
);

type SortBy = 'newest' | 'oldest' | 'label' | 'active';
type CsvValue = string | number | boolean | null | undefined;

const parseSortBy = (value: string): SortBy => {
  if (
    value === 'newest' ||
    value === 'oldest' ||
    value === 'label' ||
    value === 'active'
  ) {
    return value;
  }
  return 'newest';
};

const escapeCsvValue = (val: CsvValue): string => {
  /* v8 ignore next 3 */
  if (val === undefined || val === null) {
    return '';
  }
  let str = String(val);
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  if (
    str.includes('"') ||
    str.includes(',') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
};

const HmeListView = ({
  pms,
  fetchedHmeEmails,
  selectedIndex,
  onSelectIndex,
  searchPrompt,
  onSearchPromptChange,
  activationCallbackFactory,
  deletionCallbackFactory,
  editCallbackFactory,
  onBulkDeactivate,
  onBulkDelete,
}: HmeListViewProps) => {
  const [copiedId, setCopiedId] = useState<string>();
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [rangeAnchorIndex, setRangeAnchorIndex] = useState(selectedIndex);

  const [sortBy, setSortBy] = useState<SortBy>(() => {
    const saved = sessionStorage.getItem('hme_sort_by');
    if (
      saved === 'newest' ||
      saved === 'oldest' ||
      saved === 'label' ||
      saved === 'active'
    ) {
      return saved;
    }
    return 'newest';
  });

  const handleSortByChange = useCallback(
    (newSortBy: SortBy) => {
      setSortBy(newSortBy);
      sessionStorage.setItem('hme_sort_by', newSortBy);
      onSelectIndex(0);
    },
    [onSelectIndex]
  );

  const searchEngine = useMemo(
    () =>
      new Fuse(fetchedHmeEmails, {
        keys: ['label', 'hme'],
        threshold: 0.4,
      }),
    [fetchedHmeEmails]
  );

  const hmeEmails = useMemo(() => {
    const baseList =
      searchHmeEmails(searchPrompt ?? '', searchEngine) ?? fetchedHmeEmails;
    return [...baseList].sort((a, b) => {
      if (sortBy === 'newest') {
        return b.createTimestamp - a.createTimestamp;
      }
      if (sortBy === 'oldest') {
        return a.createTimestamp - b.createTimestamp;
      }
      if (sortBy === 'label') {
        return a.label.localeCompare(b.label);
      }
      /* v8 ignore next */
      if (sortBy === 'active') {
        return (
          /* v8 ignore next */
          (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0) ||
          b.createTimestamp - a.createTimestamp
        );
      }
      /* v8 ignore next */
      return 0;
    });
  }, [fetchedHmeEmails, searchEngine, searchPrompt, sortBy]);

  const selectedRowRef = useRef<HTMLDivElement>(null);
  const selectedButtonRef = useRef<HTMLButtonElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const isMultiSelectMode = checkedIds.size > 0;

  const clearBulkSelection = useCallback(() => {
    setCheckedIds(new Set());
    setConfirmingBulkDelete(false);
  }, []);

  useEffect(() => {
    /* v8 ignore next */
    if (selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({
        behavior: 'auto',
        block: 'nearest',
      });
    }

    /* v8 ignore next 5 */
    if (listContainerRef.current?.contains(document.activeElement)) {
      selectedButtonRef.current?.focus();
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (hmeEmails.length === 0) {
      return;
    }

    if (selectedIndex >= hmeEmails.length) {
      onSelectIndex(hmeEmails.length - 1);
    }
  }, [hmeEmails, selectedIndex, onSelectIndex]);

  useEffect(() => {
    if (checkedIds.size === 0) {
      setConfirmingBulkDelete(false);
    }
  }, [checkedIds.size]);

  const onQuickCopy = useCallback((hme: HmeEmail, event: React.MouseEvent) => {
    event.stopPropagation();
    navigator.clipboard.writeText(hme.hme).catch(
      /* v8 ignore next */
      () => undefined
    );
    setCopiedId(hme.anonymousId);
    /* v8 ignore next */
    setTimeout(
      () =>
        setCopiedId((prev) => (prev === hme.anonymousId ? undefined : prev)),
      1500
    );
  }, []);

  const toggleCheckedAtIndex = useCallback(
    (index: number) => {
      const hme = hmeEmails[index];
      /* v8 ignore next 3 */
      if (hme === undefined) {
        return;
      }
      const anchorHme = hmeEmails[rangeAnchorIndex];

      setCheckedIds((prev) => {
        const next = new Set(prev);
        if (next.has(hme.anonymousId)) {
          next.delete(hme.anonymousId);
        } else {
          if (
            next.size === 0 &&
            anchorHme !== undefined &&
            anchorHme.anonymousId !== hme.anonymousId
          ) {
            next.add(anchorHme.anonymousId);
          }
          next.add(hme.anonymousId);
        }
        return next;
      });
      setRangeAnchorIndex(index);
    },
    [hmeEmails, rangeAnchorIndex]
  );

  const selectCheckedRange = useCallback(
    (fromIndex: number, toIndex: number) => {
      const startIndex = Math.min(fromIndex, toIndex);
      const endIndex = Math.max(fromIndex, toIndex);

      setCheckedIds(() => {
        const next = new Set<string>();
        for (const hme of hmeEmails.slice(startIndex, endIndex + 1)) {
          next.add(hme.anonymousId);
        }
        return next;
      });
      setRangeAnchorIndex(toIndex);
    },
    [hmeEmails]
  );

  const handleRowSelect = useCallback(
    (idx: number, event: React.MouseEvent<HTMLButtonElement>) => {
      onSelectIndex(idx);

      if (event.shiftKey) {
        selectCheckedRange(rangeAnchorIndex, idx);
        return;
      }

      if (event.metaKey || event.ctrlKey) {
        toggleCheckedAtIndex(idx);
        return;
      }

      clearBulkSelection();
      setRangeAnchorIndex(idx);
    },
    [
      clearBulkSelection,
      onSelectIndex,
      rangeAnchorIndex,
      selectCheckedRange,
      toggleCheckedAtIndex,
    ]
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && checkedIds.size > 0) {
      event.preventDefault();
      clearBulkSelection();
      return;
    }

    if (hmeEmails.length === 0) return;

    const target = event.target;
    /* v8 ignore next 3 */
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const isRowSelectButton =
      target.tagName === 'BUTTON' && target.dataset.rowSelectButton === 'true';
    const isListContainer = target === listContainerRef.current;

    if (!isRowSelectButton && !isListContainer) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = Math.min(selectedIndex + 1, hmeEmails.length - 1);
      onSelectIndex(nextIndex);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = Math.max(selectedIndex - 1, 0);
      onSelectIndex(prevIndex);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (event.shiftKey) {
        selectCheckedRange(rangeAnchorIndex, selectedIndex);
        return;
      }
      if (event.metaKey || event.ctrlKey) {
        toggleCheckedAtIndex(selectedIndex);
        return;
      }
      selectedButtonRef.current?.click();
    }
  };

  const handleExportCsv = useCallback(() => {
    const headers = [
      'email',
      'label',
      'note',
      'isActive',
      'forwardToEmail',
      'createdAt',
    ];
    const rows = hmeEmails.map((hme) => [
      escapeCsvValue(hme.hme),
      escapeCsvValue(hme.label),
      escapeCsvValue(hme.note),
      escapeCsvValue(hme.isActive),
      escapeCsvValue(hme.forwardToEmail),
      escapeCsvValue(new Date(hme.createTimestamp).toISOString()),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `icloud_hme_aliases_${new Date().toISOString().split('T')[0]}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [hmeEmails]);

  const handleBulkDeactivate = useCallback(async () => {
    setIsBulkProcessing(true);
    const ids = [...checkedIds];
    const deactivatedIds: string[] = [];
    for (const id of ids) {
      try {
        await pms.deactivateHme(id);
        deactivatedIds.push(id);
      } catch (e) {
        console.warn(`Failed to deactivate alias ${id}: ${formatError(e)}`);
      }
    }
    onBulkDeactivate(deactivatedIds);
    clearBulkSelection();
    setIsBulkProcessing(false);
  }, [checkedIds, clearBulkSelection, pms, onBulkDeactivate]);

  const handleBulkDelete = useCallback(async () => {
    setIsBulkProcessing(true);
    const ids = [...checkedIds];
    const deletedIds: string[] = [];
    for (const id of ids) {
      try {
        await pms.deleteHme(id);
        deletedIds.push(id);
      } catch (e) {
        console.warn(`Failed to delete alias ${id}: ${formatError(e)}`);
      }
    }
    onBulkDelete(deletedIds);
    clearBulkSelection();
    setIsBulkProcessing(false);
  }, [checkedIds, clearBulkSelection, pms, onBulkDelete]);

  const rowBaseClass =
    'flex items-center border-b border-slate-800/50 bg-slate-950/40 text-sm font-medium text-slate-200 transition-colors duration-150 focus-within:ring-2 focus-within:ring-inset focus-within:ring-rainbow-purple/60';
  const rowSelectedClass =
    'bg-gradient-to-r from-[rgba(139,92,246,0.4)] via-[rgba(79,70,229,0.4)] to-[rgba(66,133,244,0.4)] text-white shadow-[inset_0_0_0_1px_rgba(129,140,248,0.4)]';
  const rowBulkSelectedClass =
    'bg-gradient-to-r from-rainbow-purple/25 via-indigo-500/20 to-rainbow-blue/20 text-white shadow-[inset_3px_0_0_rgba(139,92,246,0.95)] ring-1 ring-inset ring-indigo-300/25';
  const rowBulkActiveClass = 'ring-2 ring-inset ring-rainbow-purple/70';
  const rowActiveClass =
    'bg-slate-900/95 text-white ring-1 ring-inset ring-rainbow-purple/50';

  const getRowStateClass = (isBulkSelected: boolean, isSelected: boolean) => {
    if (isBulkSelected) {
      return `${rowBulkSelectedClass} ${isSelected ? rowBulkActiveClass : ''}`;
    }
    if (isSelected && isMultiSelectMode) {
      return rowActiveClass;
    }
    if (isSelected) {
      return rowSelectedClass;
    }
    return 'hover:bg-slate-900/80';
  };

  const labelList = hmeEmails.map((hme, idx) => {
    const isSelected = idx === selectedIndex;
    const isBulkSelected = checkedIds.has(hme.anonymousId);
    const rowStateClass = getRowStateClass(isBulkSelected, isSelected);
    return (
      <div
        key={hme.anonymousId}
        ref={isSelected ? selectedRowRef : undefined}
        className={`${rowBaseClass} ${rowStateClass} group`}
      >
        <button
          ref={isSelected ? selectedButtonRef : undefined}
          aria-current={isSelected}
          aria-pressed={isBulkSelected}
          type="button"
          data-row-select-button="true"
          className="min-w-0 flex-1 truncate px-3 py-3 text-left focus:outline-none"
          onClick={(event) => handleRowSelect(idx, event)}
        >
          {hme.isActive ? (
            hme.label
          ) : (
            <span
              title="Deactivated"
              className="inline-flex items-center gap-1"
            >
              <BanIcon className="h-4 w-4 text-rainbow-red" />
              {hme.label}
            </span>
          )}
        </button>
        <button
          type="button"
          title={copiedId === hme.anonymousId ? 'Copied!' : 'Copy alias'}
          onClick={(e) => onQuickCopy(hme, e)}
          className="mr-1 shrink-0 rounded-lg p-1.5 text-slate-500 opacity-0 transition hover:text-slate-200 focus:opacity-100 focus:outline-none group-hover:opacity-100"
        >
          {copiedId === hme.anonymousId ? (
            <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <ClipboardIcon className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    );
  });

  const selectedHmeEmail =
    hmeEmails.length === 0 ? undefined : hmeEmails[selectedIndex];

  const noSearchResult = (
    <div className="break-words p-4 text-center text-slate-500">
      No results for &quot;{searchPrompt}&quot;
    </div>
  );

  return (
    <div className="flex h-[min(450px,calc(100vh-170px))] min-h-0 overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/50 shadow-inner shadow-slate-900/50">
      <div className="flex min-h-0 w-[30%] min-w-[220px] max-w-[30%] shrink-0 flex-col overflow-hidden rounded-l-3xl bg-slate-950/70">
        <SearchBar
          searchPrompt={searchPrompt}
          onSearchPromptChange={onSearchPromptChange}
          sortBy={sortBy}
          onSortByChange={handleSortByChange}
          onExportClick={handleExportCsv}
        />
        {checkedIds.size > 0 && (
          <div className="max-w-full shrink-0 space-y-2 overflow-hidden border-b border-slate-800/60 bg-slate-900/80 px-3 py-3">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs font-medium text-slate-400">
                {checkedIds.size} selected
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {isBulkProcessing && (
                  <SpinnerIcon className="h-3.5 w-3.5 animate-spin text-slate-500" />
                )}
                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={clearBulkSelection}
                  aria-label="Clear selection"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-700/80 bg-slate-950/70 px-2 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-rainbow-purple/60 disabled:opacity-50"
                >
                  <XIcon className="h-3 w-3" />
                  Clear
                </button>
              </div>
            </div>
            <div className="grid gap-2">
              {confirmingBulkDelete ? (
                <>
                  <span className="text-xs font-medium text-red-300">
                    Delete {checkedIds.size} alias
                    {checkedIds.size > 1 ? 'es' : ''}?
                  </span>
                  <button
                    type="button"
                    disabled={isBulkProcessing}
                    onClick={handleBulkDelete}
                    className="w-full rounded-lg bg-red-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    disabled={isBulkProcessing}
                    onClick={() => setConfirmingBulkDelete(false)}
                    className="w-full rounded-lg bg-slate-700 px-2 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-600 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isBulkProcessing}
                    onClick={handleBulkDeactivate}
                    className="w-full rounded-lg bg-amber-600/80 px-2 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                  >
                    Deactivate selected
                  </button>
                  <button
                    type="button"
                    disabled={isBulkProcessing}
                    onClick={() => setConfirmingBulkDelete(true)}
                    className="w-full rounded-lg bg-red-600/80 px-2 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    Delete selected
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        <div
          ref={listContainerRef}
          onKeyDown={handleKeyDown}
          className="min-h-0 flex-1 overflow-y-auto focus:outline-none"
          role="tree"
          tabIndex={0}
          aria-label="Hide My Email aliases"
          aria-multiselectable={isMultiSelectMode}
        >
          {hmeEmails.length === 0 && searchPrompt ? noSearchResult : labelList}
        </div>
      </div>
      <div className="min-h-0 basis-[70%] grow overflow-hidden rounded-r-3xl border-l border-slate-800/60 bg-slate-950/80 p-3">
        {selectedHmeEmail && (
          <HmeDetails
            pms={pms}
            hme={selectedHmeEmail}
            activationCallback={activationCallbackFactory(selectedHmeEmail)}
            deletionCallback={deletionCallbackFactory(selectedHmeEmail)}
            editCallback={editCallbackFactory(selectedHmeEmail)}
          />
        )}
      </div>
    </div>
  );
};

const HmeManager = (props: {
  callback: TransitionCallback<AuthenticatedAndManagingAction>;
  pms: HmeService;
  client: ICloudClient | null;
  setClientState: Dispatch<Store['clientState']>;
  mockMode: boolean;
}) => {
  const [fetchedHmeEmails, setFetchedHmeEmails] = useState<HmeEmail[]>();
  const [hmeEmailsError, setHmeEmailsError] = useState<string>();
  const [isFetching, setIsFetching] = useState(true);
  const [isBackgroundFetching, setIsBackgroundFetching] = useState(false);
  const [selectedHmeIdx, setSelectedHmeIdx] = useState(0);
  const [searchPrompt, setSearchPrompt] = useState<string>();

  const [cachedHmeList, setCachedHmeList, isCacheLoading] =
    useBrowserStorageState('cachedHmeList', undefined);

  const [initialCacheLoaded, setInitialCacheLoaded] = useState(false);

  useEffect(() => {
    if (isCacheLoading || initialCacheLoaded) return;

    setInitialCacheLoaded(true);

    if (cachedHmeList) {
      const sortedEmails = [...cachedHmeList.hmeEmails].sort(
        (a, b) => b.createTimestamp - a.createTimestamp
      );
      setFetchedHmeEmails(sortedEmails);
      setIsFetching(false);
    } else {
      setIsFetching(true);
    }

    const fetchHmeList = async () => {
      setHmeEmailsError(undefined);
      setIsBackgroundFetching(true);
      try {
        const result = await props.pms.listHme();
        const sortedEmails = [...result.hmeEmails].sort(
          (a, b) => b.createTimestamp - a.createTimestamp
        );
        setFetchedHmeEmails(sortedEmails);
        setCachedHmeList(result);
      } catch (e) {
        if (cachedHmeList) {
          console.warn('Background refresh failed, using cached list:', e);
        } else {
          setHmeEmailsError(formatError(e));
        }
      } finally {
        setIsFetching(false);
        setIsBackgroundFetching(false);
      }
    };

    fetchHmeList();
  }, [
    isCacheLoading,
    initialCacheLoaded,
    cachedHmeList,
    props.pms,
    setCachedHmeList,
  ]);

  // Keep offline cache in sync when user edits/activates/deletes
  useEffect(() => {
    if (!fetchedHmeEmails || !initialCacheLoaded) return;
    if (
      !cachedHmeList ||
      !deepEqual(cachedHmeList.hmeEmails, fetchedHmeEmails)
    ) {
      setCachedHmeList((prev) => {
        /* v8 ignore next */
        if (!prev) return undefined;
        return {
          ...prev,
          hmeEmails: fetchedHmeEmails,
        };
      });
    }
  }, [fetchedHmeEmails, cachedHmeList, setCachedHmeList, initialCacheLoaded]);

  const activationCallbackFactory = (hmeEmail: HmeEmail) => () => {
    setFetchedHmeEmails(createActivationUpdater(hmeEmail));
  };

  const deletionCallbackFactory = (hmeEmail: HmeEmail) => () => {
    setFetchedHmeEmails(createDeletionUpdater(hmeEmail));
  };

  const editCallbackFactory =
    (hmeEmail: HmeEmail) => (label: string, note: string) => {
      setFetchedHmeEmails(createEditUpdater(hmeEmail.anonymousId, label, note));
    };

  const handleSelectIndex = useCallback((index: number) => {
    setSelectedHmeIdx(index);
  }, []);

  const handleSearchPromptChange = useCallback((value: string) => {
    setSearchPrompt(value);
    setSelectedHmeIdx(0);
  }, []);

  const handleBulkDeactivate = useCallback((ids: string[]) => {
    setFetchedHmeEmails((prev) => {
      /* v8 ignore next */
      if (!prev) return prev;
      return prev.map((e) =>
        ids.includes(e.anonymousId) ? { ...e, isActive: false } : e
      );
    });
  }, []);

  const handleBulkDelete = useCallback((ids: string[]) => {
    setFetchedHmeEmails((prev) => {
      /* v8 ignore next */
      if (!prev) return prev;
      return prev.filter((e) => !ids.includes(e.anonymousId));
    });
    setSelectedHmeIdx(0);
  }, []);

  const renderMainContent = (): ReactNode => {
    if (isFetching) {
      return <Spinner />;
    }

    if (hmeEmailsError) {
      return <ErrorMessage>{hmeEmailsError}</ErrorMessage>;
    }

    if (!fetchedHmeEmails || fetchedHmeEmails.length === 0) {
      return (
        <div className="text-center text-lg text-slate-500">
          There are no emails to list
        </div>
      );
    }

    const activeCount = fetchedHmeEmails.filter((e) => e.isActive).length;
    const inactiveCount = fetchedHmeEmails.length - activeCount;

    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs">
          <div>
            {isBackgroundFetching && (
              <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                Refreshing...
              </span>
            )}
          </div>
          <p className="text-right text-slate-500">
            <span className="text-emerald-400">{activeCount} active</span>
            {inactiveCount > 0 && (
              <span className="text-slate-500">
                {' '}
                · {inactiveCount} inactive
              </span>
            )}
          </p>
        </div>
        <HmeListView
          pms={props.pms}
          fetchedHmeEmails={fetchedHmeEmails}
          selectedIndex={selectedHmeIdx}
          onSelectIndex={handleSelectIndex}
          searchPrompt={searchPrompt}
          onSearchPromptChange={handleSearchPromptChange}
          activationCallbackFactory={activationCallbackFactory}
          deletionCallbackFactory={deletionCallbackFactory}
          editCallbackFactory={editCallbackFactory}
          onBulkDeactivate={handleBulkDeactivate}
          onBulkDelete={handleBulkDelete}
        />
      </div>
    );
  };

  return (
    <TitledComponent hideHeader>
      {props.mockMode && <MockModeBanner />}
      {renderMainContent()}
      <div className="grid grid-cols-2 pt-3">
        <div>
          <FooterButton
            onClick={() => props.callback('GENERATE')}
            icon={PlusIcon}
            label="Generate new email"
            className="bg-slate-800/80 text-slate-200 hover:bg-slate-700"
          />
        </div>
        <div className="text-right">
          {props.client !== null && (
            <SignOutButton
              callback={props.callback}
              client={props.client}
              setClientState={props.setClientState}
            />
          )}
        </div>
      </div>
    </TitledComponent>
  );
};

const constructClient = (
  clientState: NonNullable<Store['clientState']>
): ICloudClient => {
  return new ICloudClient(clientState.setupUrl, clientState.webservices);
};

const transitionToNextStateElement = (
  state: PopupState,
  setState: Dispatch<PopupState>,
  clientState: Store['clientState'],
  setClientState: Dispatch<Store['clientState']>,
  mockMode: boolean,
  mockPremiumMailSettings: HmeService
): ReactElement => {
  switch (state) {
    case PopupState.SignedOut: {
      // In mock mode we never reach SignedOut — the Popup component handles it.
      return <SignInInstructions />;
    }
    case PopupState.Authenticated: {
      const callback = (action: AuthenticatedAction) =>
        setState(STATE_MACHINE_TRANSITIONS[state][action]);
      if (mockMode) {
        return (
          <HmeGenerator
            callback={callback}
            pms={mockPremiumMailSettings}
            client={null}
            setClientState={setClientState}
            mockMode={mockMode}
          />
        );
      }
      const client = constructClient(clientState);
      const pms: HmeService = new PremiumMailSettings(client);
      return (
        <HmeGenerator
          callback={callback}
          pms={pms}
          client={client}
          setClientState={setClientState}
          mockMode={mockMode}
        />
      );
    }
    case PopupState.AuthenticatedAndManaging: {
      const callback = (action: AuthenticatedAndManagingAction) =>
        setState(STATE_MACHINE_TRANSITIONS[state][action]);
      if (mockMode) {
        return (
          <HmeManager
            callback={callback}
            pms={mockPremiumMailSettings}
            client={null}
            setClientState={setClientState}
            mockMode={mockMode}
          />
        );
      }
      const client = constructClient(clientState);
      const pms: HmeService = new PremiumMailSettings(client);
      return (
        <HmeManager
          callback={callback}
          pms={pms}
          client={client}
          setClientState={setClientState}
          mockMode={mockMode}
        />
      );
    }
    default: {
      const exhaustivenessCheck: never = state;
      throw new Error(`Unhandled PopupState case: ${exhaustivenessCheck}`);
    }
  }
};

const syncClientAuthState = async (
  clientState: Store['clientState'],
  setState: Dispatch<PopupState>,
  setClientState: Dispatch<Store['clientState']>,
  setClientAuthStateSynced: Dispatch<boolean>
) => {
  const isAuthenticated =
    clientState?.setupUrl !== undefined &&
    (await new ICloudClient(clientState.setupUrl).isAuthenticated());

  if (isAuthenticated) {
    setState((prevState) =>
      prevState === PopupState.SignedOut ? PopupState.Authenticated : prevState
    );
  } else {
    setState(PopupState.SignedOut);
    setClientState(undefined);
    await performDeauthSideEffects();
  }

  setClientAuthStateSynced(true);
};

const Popup = () => {
  const [state, setState, isStateLoading] = useBrowserStorageState(
    'popupState',
    PopupState.SignedOut
  );

  const [clientState, setClientState, isClientStateLoading] =
    useBrowserStorageState('clientState', undefined);
  const [clientAuthStateSynced, setClientAuthStateSynced] = useState(false);

  const [mockMode, , isMockModeLoading] = useBrowserStorageState(
    'mockMode',
    DEFAULT_STORE.mockMode
  );
  const [mockPremiumMailSettings] = useState<HmeService>(
    () => new MockPremiumMailSettings()
  );
  const shouldRenderSignedOut =
    !mockMode &&
    clientState === undefined &&
    (state === PopupState.Authenticated ||
      state === PopupState.AuthenticatedAndManaging);

  // When mock mode is on, skip real iCloud auth entirely and jump to Authenticated.
  useEffect(() => {
    /* v8 ignore next */
    if (isMockModeLoading) return;
    if (mockMode) {
      setState(PopupState.Authenticated);
      setClientAuthStateSynced(true);
      return;
    }
    if (!isClientStateLoading && !clientAuthStateSynced) {
      syncClientAuthState(
        clientState,
        setState,
        setClientState,
        setClientAuthStateSynced
      );
    }
  }, [
    mockMode,
    isMockModeLoading,
    setState,
    setClientState,
    clientAuthStateSynced,
    clientState,
    isClientStateLoading,
  ]);

  useEffect(() => {
    if (shouldRenderSignedOut) {
      setState(PopupState.SignedOut);
    }
  }, [setState, shouldRenderSignedOut]);

  const isLoading =
    isStateLoading ||
    isMockModeLoading ||
    (!mockMode && !clientAuthStateSynced);
  const nextState = shouldRenderSignedOut ? PopupState.SignedOut : state;

  return (
    <div className="flex items-start justify-center px-4 py-4 text-slate-100">
      <div className="w-full max-w-[960px]">
        {isLoading ? (
          <Spinner />
        ) : (
          transitionToNextStateElement(
            nextState,
            setState,
            clientState,
            setClientState,
            /* v8 ignore next */ mockMode ?? false,
            mockPremiumMailSettings
          )
        )}
      </div>
    </div>
  );
};

export default Popup;
