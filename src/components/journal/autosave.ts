/**
 * Journal autosave, independent of React so it can be tested with fake timers.
 *
 * - Every change goes through change(patch): the latest content, intention
 *   and mood are kept, and a save is scheduled 800ms after the last change.
 * - One save at a time. Changes made during a save go out right after it,
 *   with the version the server just returned.
 * - A STALE result (another device saved first) stops autosaving until the
 *   page reloads the entry, so nothing gets overwritten.
 * - flushNow() saves immediately (tab hidden, page leaving).
 */

export type JournalPatch = { content?: unknown; intention?: string | null; mood?: number | null };

export type SaveRequest = {
  content: unknown;
  version: number;
  intention?: string | null;
  mood?: number | null;
};

export type SaveOutcome =
  | { ok: true; version: number }
  | { ok: false; stale: true; currentVersion: number | null }
  | { ok: false; stale: false; message: string };

export type AutosaveStatus =
  | { state: "idle" }
  | { state: "pending" }
  | { state: "saving" }
  | { state: "saved"; at: Date }
  | { state: "error"; message: string }
  | { state: "stale" };

export type AutosaverOptions = {
  initialContent: unknown;
  initialVersion: number;
  save: (request: SaveRequest) => Promise<SaveOutcome>;
  onStatus: (status: AutosaveStatus) => void;
  /** Called after each successful save with the new version. */
  onSaved?: (version: number) => void;
  delayMs?: number;
  now?: () => Date;
};

export const AUTOSAVE_DELAY_MS = 800;

export function createAutosaver({
  initialContent,
  initialVersion,
  save,
  onStatus,
  onSaved,
  delayMs = AUTOSAVE_DELAY_MS,
  now = () => new Date(),
}: AutosaverOptions) {
  let content = initialContent;
  let version = initialVersion;
  /** Fields changed since the last successful save. */
  let dirty: { content: boolean; intention?: string | null; mood?: number | null } = { content: false };
  let hasChanges = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let stopped = false;
  /** Bumped on every change(), to tell whether edits arrived during a save. */
  let changeCount = 0;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  async function run(): Promise<void> {
    if (stopped || !hasChanges) return;
    if (inFlight !== null) {
      // A save is running; this change goes out right after it.
      await inFlight;
      return run();
    }
    const countAtSend = changeCount;
    const sending = dirty;
    dirty = { content: false };
    hasChanges = false;
    const request: SaveRequest = {
      content,
      version,
      ...("intention" in sending ? { intention: sending.intention } : {}),
      ...("mood" in sending ? { mood: sending.mood } : {}),
    };
    onStatus({ state: "saving" });
    inFlight = (async () => {
      let outcome: SaveOutcome;
      try {
        outcome = await save(request);
      } catch {
        outcome = { ok: false, stale: false, message: "Couldn't save. Check your connection." };
      }
      if (outcome.ok) {
        version = outcome.version;
        onSaved?.(version);
        if (!hasChanges) onStatus({ state: "saved", at: now() });
      } else if (outcome.stale) {
        stopped = true;
        clearTimer();
        onStatus({ state: "stale" });
      } else {
        // Keep what didn't save so the next change (or flush) retries it.
        dirty = { ...sending, ...dirty, content: sending.content || dirty.content };
        hasChanges = true;
        onStatus({ state: "error", message: outcome.message });
      }
    })();
    try {
      await inFlight;
    } finally {
      inFlight = null;
    }
    // Send edits made during the save right away, unless a timer will. After an
    // error with no new edits, wait for the next change or flushNow() instead
    // of retrying in a loop.
    if (changeCount !== countAtSend && hasChanges && !stopped && timer === null) await run();
  }

  return {
    change(patch: JournalPatch) {
      if (stopped) return;
      if ("content" in patch) {
        content = patch.content;
        dirty.content = true;
      }
      if ("intention" in patch) dirty.intention = patch.intention;
      if ("mood" in patch) dirty.mood = patch.mood;
      hasChanges = true;
      changeCount += 1;
      clearTimer();
      onStatus({ state: "pending" });
      timer = setTimeout(() => {
        timer = null;
        void run();
      }, delayMs);
    },
    /** Save now if anything is waiting. */
    flushNow(): Promise<void> {
      clearTimer();
      return run();
    },
    get version() {
      return version;
    },
    get stopped() {
      return stopped;
    },
    dispose() {
      clearTimer();
    },
  };
}

export type Autosaver = ReturnType<typeof createAutosaver>;
