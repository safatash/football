"use client";

import { useState } from "react";
import { HONEYPOT_FIELD } from "@/lib/honeypot";

/**
 * A field people never see: off-screen, hidden from screen readers and skipped by Tab. Returns
 * the field to render and the body entry to send with the request.
 */
export function useHoneypot() {
  const [value, setValue] = useState("");
  const field = (
    <div aria-hidden="true" className="pointer-events-none absolute -left-[10000px] h-px w-px overflow-hidden">
      <label>
        Website
        <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
    </div>
  );
  return { field, body: { [HONEYPOT_FIELD]: value } };
}
