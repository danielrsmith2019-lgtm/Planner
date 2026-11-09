import { describe, expect, it } from "vitest";
import { RANK_DIGITS, rankAfter, rankBefore, rankBetween, ranksAfter } from "./rank";

describe("rank", () => {
  it("creates a first rank for an empty list", () => {
    expect(typeof rankAfter(null)).toBe("string");
    expect(rankBetween(null, null)).toBe(rankAfter(null));
  });

  it("puts rankAfter(last) after last", () => {
    const first = rankAfter(null);
    const second = rankAfter(first);
    expect(second > first).toBe(true);
  });

  it("puts rankBefore(first) before first", () => {
    const first = rankAfter(null);
    expect(rankBefore(first) < first).toBe(true);
  });

  it("puts rankBetween(a, b) strictly between a and b", () => {
    const a = rankAfter(null);
    const b = rankAfter(a);
    const mid = rankBetween(a, b);
    expect(mid > a && mid < b).toBe(true);
  });

  it("keeps order through many inserts at the same spot", () => {
    const a = rankAfter(null);
    let b = rankAfter(a);
    const inserted: string[] = [];
    for (let i = 0; i < 50; i++) {
      b = rankBetween(a, b);
      inserted.push(b);
    }
    const sorted = [...inserted].sort();
    expect(sorted).toEqual([...inserted].reverse());
    expect(sorted.every((r) => r > a)).toBe(true);
  });

  it("generates n ordered ranks after the last one", () => {
    const last = rankAfter(null);
    const next = ranksAfter(last, 5);
    expect(next).toHaveLength(5);
    expect([last, ...next]).toEqual([last, ...next].slice().sort());
  });

  it("throws when a is not before b", () => {
    const a = rankAfter(null);
    const b = rankAfter(a);
    expect(() => rankBetween(b, a)).toThrow();
  });

  it("only uses 0-9 and a-z, so Postgres en_US collation sorts ranks like JavaScript", () => {
    expect(RANK_DIGITS).toBe("0123456789abcdefghijklmnopqrstuvwxyz");
    // Random inserts at the front, back and middle of a list, including many
    // rankBefore calls that push into the "negative" integer range.
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const list: string[] = [rankAfter(null)];
    for (let i = 0; i < 400; i++) {
      const r = random();
      if (r < 0.3) list.unshift(rankBefore(list[0]));
      else if (r < 0.6) list.push(rankAfter(list[list.length - 1]));
      else {
        const at = 1 + Math.floor(random() * (list.length - 1));
        list.splice(at, 0, rankBetween(list[at - 1], list[at]));
      }
    }
    expect(list.every((rank) => /^[0-9a-z]+$/.test(rank))).toBe(true);
    expect([...list].sort()).toEqual(list);
  });
});
