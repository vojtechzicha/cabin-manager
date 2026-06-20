import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

/** Small mono uppercase section label. */
export function SectionLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mono text-[10px] uppercase tracking-[0.12em] text-muted ${className}`}>
      {children}
    </div>
  );
}

/** Warm card surface — the workhorse container. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-line bg-card p-4 ${className}`}>{children}</div>
  );
}

/** The signature cream sheet that overlaps a hero with a soft rounded top. */
export function Sheet({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative z-10 -mt-7 rounded-t-sheet bg-paper px-5 pt-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // Primary carries the canonical accent drop-shadow from the Design System kit (§07).
  primary: "bg-accent text-white shadow-[0_8px_18px_-8px_var(--accent)]",
  secondary: "border border-line bg-card text-ink",
  ghost: "text-accent-ink",
};

/**
 * Primary action button. Generous tap target (min 44px tall) so primary
 * actions stay thumb-reachable on phones (PRD §12).
 */
export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: { variant?: ButtonVariant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-btn px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${BUTTON_VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Labeled form field wrapper. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <SectionLabel>{label}</SectionLabel>
      {children}
      {hint ? <span className="text-[12px] text-muted">{hint}</span> : null}
    </label>
  );
}

/** Text input with the warm spine styling. */
export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-11 rounded-btn border border-line bg-card px-3.5 py-2.5 text-sm outline-none placeholder:text-sand focus:border-accent ${className}`}
      {...rest}
    />
  );
}

/** Vertical list with hairline separators. */
export function List({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <ul className={`divide-y divide-line overflow-hidden rounded-card border border-line bg-card ${className}`}>
      {children}
    </ul>
  );
}

export function ListItem({
  children,
  trailing,
  className = "",
}: {
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <li className={`flex items-center justify-between gap-3 px-4 py-3 ${className}`}>
      <div className="min-w-0">{children}</div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </li>
  );
}
