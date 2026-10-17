import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * accent  — the one key action on a screen (lime, dark text)
 * primary — pitch green, white text
 * ghost   — outlined secondary
 * quiet   — filled neutral
 * danger  — destructive
 * link    — inline text action
 * (secondary / outline kept as aliases of ghost for older call sites)
 */
export type ButtonVariant = "accent" | "primary" | "ghost" | "quiet" | "danger" | "link" | "secondary" | "outline";
export type ButtonSize = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full border border-transparent font-bold whitespace-nowrap transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45";

const variants: Record<ButtonVariant, string> = {
  accent: "bg-lime text-lime-ink hover:bg-lime-2",
  primary: "bg-pitch text-on-pitch hover:bg-pitch-2",
  ghost: "border-line-strong bg-transparent text-fg hover:bg-surface-2",
  secondary: "border-line-strong bg-transparent text-fg hover:bg-surface-2",
  outline: "border-line-strong bg-transparent text-fg hover:bg-surface-2",
  quiet: "bg-surface-2 text-fg hover:bg-surface-3",
  danger: "bg-bad text-white hover:opacity-90",
  link: "!min-h-0 !p-0 !rounded-none bg-transparent text-pitch-2 underline underline-offset-4 hover:text-pitch dark:text-lime",
};

const sizes: Record<ButtonSize, string> = {
  md: "min-h-11 px-[18px] text-[15px]",
  sm: "min-h-9 px-3.5 text-[13.5px]",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", block = false, className = "") {
  return [base, sizes[size], variants[variant], block ? "w-full" : "", className].filter(Boolean).join(" ");
}

type CommonProps = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; className?: string; children: ReactNode };

export function Button({
  variant = "primary",
  size = "md",
  block,
  className,
  type = "button",
  children,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={buttonClass(variant, size, block, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  block,
  className,
  children,
  ...rest
}: CommonProps & { href: string; prefetch?: boolean; "aria-label"?: string }) {
  return (
    <Link href={href} className={buttonClass(variant, size, block, className)} {...rest}>
      {children}
    </Link>
  );
}
