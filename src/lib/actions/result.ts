import { ZodError } from "zod";
import { SeasonReadOnlyError } from "@/lib/queries/season";
import { ForbiddenError, UnauthorizedError } from "@/lib/team-access";

/** What every server action returns. `status` mirrors HTTP so callers and tests can check 401/403. */
export type ActionResult<T = undefined> =
  | { ok: true; message: string; warnings?: string[]; data?: T }
  | { ok: false; status: 400 | 401 | 403 | 404 | 409 | 500; error: string; errors?: string[] };

export class ActionError extends Error {
  constructor(
    message: string,
    public status: 400 | 404 | 409 = 400,
    public errors?: string[],
  ) {
    super(message);
  }
}

/** Runs an action body and turns thrown errors into an ActionResult. */
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof UnauthorizedError) return { ok: false, status: 401, error: e.message };
    if (e instanceof ForbiddenError) return { ok: false, status: 403, error: e.message };
    if (e instanceof SeasonReadOnlyError) return { ok: false, status: 409, error: e.message };
    if (e instanceof ActionError) return { ok: false, status: e.status, error: e.message, errors: e.errors };
    if (e instanceof ZodError) return { ok: false, status: 400, error: e.issues[0]?.message ?? "Check your input and try again." };
    console.error("Action failed", e);
    return { ok: false, status: 500, error: "Something went wrong. Try again in a moment." };
  }
}
