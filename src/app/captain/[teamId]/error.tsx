"use client";

import { ErrorState } from "@/components/shell/states";

export default function SectionError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <ErrorState error={error} retry={unstable_retry} homeHref="/portal" homeLabel="Back to my portal" />;
}
