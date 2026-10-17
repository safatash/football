"use client";

import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/controls";
import { Icon, type IconName } from "@/components/ui/icon";

/** A button whose action is confirmed with a toast. */
export function ToastButton({
  label,
  message,
  icon,
  variant = "ghost",
  size = "sm",
  block,
  disabled,
  className,
}: {
  label: string;
  message: string;
  icon?: IconName;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [toast, showToast] = useToast();
  return (
    <>
      <Button variant={variant} size={size} block={block} disabled={disabled} className={className} onClick={() => showToast(message)}>
        {icon ? <Icon name={icon} className="size-4" /> : null}
        {label}
      </Button>
      <Toast message={toast} />
    </>
  );
}
