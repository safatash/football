import type { Metadata, Viewport } from "next";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "@fontsource-variable/figtree";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";
import { BrandProvider } from "@/components/brand";
import { getBrand } from "@/lib/branding";
import { themeColor, themeCss } from "@/lib/theme";

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBrand();
  return {
    title: { default: b.fullName === b.name ? b.name : `${b.name} · ${b.fullName}`, template: `%s · ${b.name}` },
    description: b.tagline ?? undefined,
    metadataBase: new URL(b.url),
  };
}

export async function generateViewport(): Promise<Viewport> {
  const b = await getBrand();
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: themeColor(b.primaryColor) },
      { media: "(prefers-color-scheme: dark)", color: "#0b1410" },
    ],
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const b = await getBrand();
  const css = themeCss(b.primaryColor, b.accentColor);
  return (
    <html lang="en" className="h-full">
      {/* The league's colors (validated hex values only; see lib/theme.ts) */}
      {css ? (
        <head>
          <style>{css}</style>
        </head>
      ) : null}
      {/* Browser extensions (e.g. ColorZilla) add attributes to <body> before React loads */}
      <body className="min-h-full bg-bg text-fg" suppressHydrationWarning>
        <BrandProvider brand={{ name: b.name, fullName: b.fullName, logoUrl: b.logoUrl, contactEmail: b.contactEmail, supportEmail: b.supportEmail, social: b.social, appName: b.appName }}>
          {children}
        </BrandProvider>
      </body>
    </html>
  );
}
