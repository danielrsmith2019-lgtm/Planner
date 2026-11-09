/**
 * Errors services throw on purpose. Server Actions map these to
 * { ok: false, error } and let anything else surface as a 500.
 */

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} was not found.`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * A journal save was based on an old version (another tab or device saved
 * first). The client should show "This entry changed elsewhere" and reload.
 */
export class StaleEntryError extends Error {
  readonly currentVersion: number;

  constructor(date: string, expectedVersion: number, currentVersion: number) {
    super(`Journal entry for ${date} is at version ${currentVersion}, not ${expectedVersion}.`);
    this.name = "StaleEntryError";
    this.currentVersion = currentVersion;
  }
}
