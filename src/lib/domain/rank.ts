import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

/**
 * Fractional ranks for ordered lists (goals, milestones, tasks within a day).
 * Moving an item writes one row: give it a rank between its new neighbours.
 *
 * Ranks use only 0-9 and a-z. The library's default alphabet mixes upper and
 * lower case, which Postgres sorts differently under the database's en_US
 * collation than JavaScript does ("a0b" before "a0V"), so ORDER BY rank would
 * scramble lists. With this alphabet, JavaScript string order, Postgres en_US
 * order and Postgres "C" order all agree.
 */
export const RANK_DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * A rank strictly between a and b. Pass null for an open end.
 * Throws if a >= b: reversed neighbours mean the caller's list is stale, so
 * fail loudly instead of letting fractional-indexing (v4) quietly swap them.
 */
export function rankBetween(a: string | null, b: string | null): string {
  if (a !== null && b !== null && a >= b) {
    throw new RangeError(`rankBetween: "${a}" must sort before "${b}"`);
  }
  return generateKeyBetween(a, b, RANK_DIGITS);
}

/** A rank after the current last item (null for an empty list). */
export function rankAfter(last: string | null): string {
  return generateKeyBetween(last, null, RANK_DIGITS);
}

/** A rank before the current first item (null for an empty list). */
export function rankBefore(first: string | null): string {
  return generateKeyBetween(null, first, RANK_DIGITS);
}

/** n ordered ranks after `last`, for inserting several items at once. */
export function ranksAfter(last: string | null, n: number): string[] {
  return generateNKeysBetween(last, null, n, RANK_DIGITS);
}
