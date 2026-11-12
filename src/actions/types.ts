/**
 * What every Server Action returns. Safe to import from client code.
 * Actions never throw to the client (except Next's own redirect).
 */
export type ActionErrorCode = "VALIDATION" | "NOT_FOUND" | "STALE" | "INTERNAL";

export type ActionError = {
  code: ActionErrorCode;
  message: string;
  /** VALIDATION from the schema: messages per input field. */
  fieldErrors?: Record<string, string[]>;
  /** STALE journal saves: the version now stored. */
  currentVersion?: number;
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

/** Thrown by query/mutation functions so TanStack Query sees a failure. */
export class ActionFailure extends Error {
  readonly code: ActionErrorCode;
  readonly detail: ActionError;

  constructor(error: ActionError) {
    super(error.message);
    this.name = "ActionFailure";
    this.code = error.code;
    this.detail = error;
  }
}

/** Unwrap an ActionResult for TanStack Query: data, or throw ActionFailure. */
export function unwrap<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new ActionFailure(result.error);
}
