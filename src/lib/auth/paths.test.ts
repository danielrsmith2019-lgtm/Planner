import { describe, expect, it } from "vitest";
import { isAuthPage, isPublicPath, safeNextPath } from "./paths";

describe("isPublicPath", () => {
  it.each(["/login", "/signup", "/auth/callback", "/login/"])("allows %s", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each(["/", "/goals", "/styleguide", "/loginx", "/login/extra", "/auth/signout", "/auth"])("protects %s", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});

describe("isAuthPage", () => {
  it("is true only for login and signup", () => {
    expect(isAuthPage("/login")).toBe(true);
    expect(isAuthPage("/signup/")).toBe(true);
    expect(isAuthPage("/auth/callback")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/goals", "/goals"],
    ["/journal/2026-11-12?mode=reflect", "/journal/2026-11-12?mode=reflect"],
  ])("keeps %s", (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected);
  });

  it.each([null, undefined, "", "goals", "//evil.example", "https://evil.example/x", "/\\evil.example", "/login", "/signup", "/auth/callback"])(
    "falls back to / for %j",
    (raw) => {
      expect(safeNextPath(raw)).toBe("/");
    },
  );
});
