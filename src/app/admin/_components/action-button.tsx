"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/controls";
import { Icon, type IconName } from "@/components/ui/icon";
import type { ActionResult } from "@/lib/actions/result";

/** Runs a (bound) server action and confirms the result with a toast. */
export function ActionButton({
  label,
  action,
  icon,
  variant = "ghost",
  size = "sm",
  block,
  disabled,
  className,
}: {
  label: string;
  action: () => Promise<ActionResult<unknown>>;
  icon?: IconName;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [toast, showToast] = useToast();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <>
      <Button
        variant={variant}
        size={size}
        block={block}
        disabled={disabled || pending}
        className={className}
        onClick={() =>
          startTransition(async () => {
            const res = await action();
            showToast(res.ok ? res.message : res.error);
            if (res.ok) router.refresh();
          })
        }
      >
        {icon ? <Icon name={icon} className="size-4" /> : null}
        {label}
      </Button>
      <Toast message={toast} />
    </>
  );
}
