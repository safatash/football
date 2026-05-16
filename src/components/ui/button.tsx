import Link from "next/link";
import { ReactNode } from "react";

type Variant = "primary" | "secondary" | "success" | "warning" | "danger" | "ghost";

type BaseProps = {
  children: ReactNode;
  className?: string;
};

const variants: Record<Variant, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-800",
  secondary: "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
  success: "bg-emerald-600 text-white hover:bg-emerald-500",
  warning: "bg-amber-500 text-white hover:bg-amber-400",
  danger: "bg-rose-600 text-white hover:bg-rose-500",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
};

const baseClass =
  "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-medium transition focus:outline-none";

function classes(variant: Variant, className?: string) {
  return `${baseClass} ${variants[variant]} ${className ?? ""}`.trim();
}

export function Button({
  children,
  variant = "primary",
  type = "button",
  className,
}: BaseProps & { variant?: Variant; type?: "button" | "submit" | "reset" }) {
  return (
    <button type={type} className={classes(variant, className)}>
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  variant = "primary",
  className,
}: BaseProps & { href: string; variant?: Variant }) {
  return (
    <Link href={href} className={classes(variant, className)}>
      {children}
    </Link>
  );
}
