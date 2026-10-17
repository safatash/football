import type { ReactNode } from "react";
import { PublicTopNav } from "@/components/shell/app-nav";

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicTopNav />
      {children}
    </div>
  );
}
