"use client";

/** The current league's brand for client components (set once in the root layout). */
import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import type { Brand } from "@/lib/branding";

export type ClientBrand = Pick<Brand, "name" | "fullName" | "logoUrl" | "contactEmail" | "supportEmail" | "social" | "appName">;

const BrandContext = createContext<ClientBrand>({ name: "", fullName: "", logoUrl: null, contactEmail: null, supportEmail: null, social: [], appName: "" });

export function BrandProvider({ brand, children }: { brand: ClientBrand; children: ReactNode }) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export const useBrand = () => useContext(BrandContext);

/** Where players write for help. */
export const useHelpEmail = () => {
  const b = useBrand();
  return b.supportEmail || b.contactEmail;
};

/** The league's logo (or a ball mark) and name. */
export function Logo({ href = "/", className = "", tone = "default" }: { href?: string; className?: string; tone?: "default" | "light" }) {
  const brand = useBrand();
  return (
    <Link href={href} className={`inline-flex items-center gap-2 font-display text-[22px] font-extrabold tracking-[0.03em] ${tone === "light" ? "text-white" : ""} ${className}`}>
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- league logos are user-uploaded files of any size
        <img src={brand.logoUrl} alt="" aria-hidden className="size-[30px] rounded-lg bg-surface object-contain" />
      ) : (
        <span className="grid size-[30px] place-items-center rounded-lg bg-lime text-lime-ink">
          <Icon name="ball" className="size-5" />
        </span>
      )}
      {brand.name}
    </Link>
  );
}

/** "office@league.org" as a mail link, or a fallback sentence when the league has no address. */
export function HelpEmailLink({ className = "" }: { className?: string }) {
  const email = useHelpEmail();
  if (!email) return <span>the league office</span>;
  return (
    <a href={`mailto:${email}`} className={className}>
      {email}
    </a>
  );
}
