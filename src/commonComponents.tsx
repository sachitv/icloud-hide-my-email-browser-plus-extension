import React, {
  ButtonHTMLAttributes,
  DetailedHTMLProps,
  ReactNode,
  useId,
} from 'react';
import { SpinnerIcon } from './icons';

export const Spinner = () => {
  return (
    <div className="flex items-center justify-center py-6">
      <SpinnerIcon className="h-8 w-8 animate-spin text-rainbow-purple drop-shadow-[0_0_12px_rgba(139,92,246,0.45)]" />
    </div>
  );
};

export const LoadingButton = (
  props: {
    loading: boolean;
  } & DetailedHTMLProps<
    ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  >
) => {
  const { loading, disabled, className, ...btnHtmlAttrs } = props;

  const defaultClassName =
    'w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_22px_40px_-26px_rgba(79,70,229,0.6)] transition duration-200 hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300/80 focus:ring-offset-2 focus:ring-offset-slate-900';

  const disabledClassName =
    'w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-700/60 px-5 py-3 text-sm font-semibold text-slate-300 shadow-inner cursor-not-allowed focus:outline-none';

  const baseClassName = disabled ? disabledClassName : defaultClassName;
  const composedClassName = [baseClassName, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="submit"
      className={composedClassName}
      disabled={loading || disabled}
      {...btnHtmlAttrs}
    >
      {loading && !disabled && (
        <SpinnerIcon className="mr-1 h-4 w-4 animate-spin" />
      )}
      {props.children}
    </button>
  );
};

export const ErrorMessage = (props: { children?: React.ReactNode }) => {
  return (
    <div
      className="rounded-2xl border border-rainbow-red/50 bg-rainbow-red/15 px-4 py-3 text-sm text-rose-100"
      role="alert"
    >
      {props.children}
    </div>
  );
};

export const TitledComponent = (props: {
  title?: string;
  subtitle?: string;
  hideHeader?: boolean;
  children?: React.ReactNode;
}) => {
  const { title, subtitle, hideHeader = false, children: childrenProp } = props;
  const children = React.Children.toArray(childrenProp) as ReactNode[];
  const sectionId = useId();

  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-800/50 bg-slate-950/70 shadow-[0_40px_80px_-60px_rgba(30,64,175,0.8)] backdrop-blur-xl">
      {!hideHeader && (
        <div className="relative px-6 py-6 text-white">
          <div className="absolute inset-0 bg-gradient-to-br from-[#4285f4] via-[rgba(79,70,229,0.8)] to-[#8b5cf6] opacity-80" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_transparent_65%)]" />
          <div className="relative">
            {title && (
              <h1 className="text-3xl font-bold tracking-tight drop-shadow-sm">
                {title}
              </h1>
            )}
            {subtitle && (
              <h2 className="mt-1 text-xs font-semibold uppercase tracking-[0.35em] text-white/80">
                {subtitle}
              </h2>
            )}
          </div>
        </div>
      )}
      {children.length > 0 && (
        <div className="divide-y divide-slate-800/60">
          {children.map((child, index) => {
            const paddingClass = index === 0 ? 'px-6 py-2' : 'px-6 py-5';
            const childKey =
              React.isValidElement(child) && child.key != null
                ? child.key
                : `${sectionId}-${index}`;
            return (
              <div
                key={childKey}
                className={`${paddingClass} text-[15px] text-slate-100/90`}
              >
                {child}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export const Link = (
  props: React.DetailedHTMLProps<
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    HTMLAnchorElement
  >
) => {
  // https://github.com/jsx-eslint/eslint-plugin-react/issues/3284
  // eslint-disable-next-line react/prop-types
  const { className, children, ...restProps } = props;
  const composedClassName = [
    'font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#4285f4] via-[#8b5cf6] to-[#e11d48] hover:from-[#e11d48] hover:via-[#ea4335] hover:to-[#fbbc05] transition-colors duration-150',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <a
      className={composedClassName}
      target="_blank"
      rel="noreferrer"
      {...restProps}
    >
      {children}
    </a>
  );
};
