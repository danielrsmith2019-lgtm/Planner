/**
 * Plan / Do / Reflect: which part of the daily loop the app is in.
 *
 *   before 11:00        plan
 *   11:00 up to 18:00   do
 *   18:00 and later     reflect
 *
 * A moment before the user's day starts (e.g. 1:30am with a 4:00am start)
 * still belongs to the previous evening, so it's "reflect", not "plan".
 */

export type DayMode = "plan" | "do" | "reflect";

export const DAY_MODES: readonly DayMode[] = ["plan", "do", "reflect"];

export const DO_STARTS_AT = 11 * 60;
export const REFLECT_STARTS_AT = 18 * 60;

/**
 * @param localMinute minutes after local midnight, 0..1439 (getLocalMinute)
 * @param dayStartsAt the user's day start in minutes (User.dayStartsAt), default 0
 */
export function getDefaultMode(localMinute: number, dayStartsAt = 0): DayMode {
  if (!Number.isInteger(localMinute) || localMinute < 0 || localMinute > 1439) {
    throw new RangeError(`localMinute must be a whole number from 0 to 1439, got ${localMinute}`);
  }
  if (localMinute < dayStartsAt) return "reflect";
  if (localMinute < DO_STARTS_AT) return "plan";
  if (localMinute < REFLECT_STARTS_AT) return "do";
  return "reflect";
}
