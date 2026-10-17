import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export const inputClass =
  "h-12 w-full rounded-[var(--radius-field)] border-[1.5px] border-line-strong bg-surface px-3.5 text-base text-fg outline-none transition placeholder:text-faint focus:border-pitch-2 focus:ring-[3px] focus:ring-lime/55 disabled:opacity-60 aria-[invalid=true]:border-bad";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className = "",
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-[13.5px] font-bold">
          {label}
        </label>
      ) : (
        <span className="text-[13.5px] font-bold">{label}</span>
      )}
      {children}
      {error ? (
        <span className="text-[12.5px] font-semibold text-bad">{error}</span>
      ) : hint ? (
        <span className="text-[12.5px] text-muted">{hint}</span>
      ) : null}
    </div>
  );
}

/** @deprecated use Field */
export function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return <Field label={label}>{children}</Field>;
}

export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${className}`} />;
}

export function SelectInput({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} cursor-pointer ${className}`} />;
}

export function TextArea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} h-auto min-h-[88px] resize-y py-3 ${className}`} />;
}
