"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export function PrintButton() {
  return (
    <Button variant="accent" size="sm" onClick={() => window.print()}>
      <Icon name="print" className="size-4" />
      Print roster
    </Button>
  );
}
