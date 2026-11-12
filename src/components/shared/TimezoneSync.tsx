"use client";

import { useEffect } from "react";
import { TIMEZONE_COOKIE } from "@/lib/auth/paths";

/**
 * Stores the browser's IANA timezone in a cookie on first load, so the server
 * can create the User with the right zone (ensureUser) before any page asks
 * "what day is it?". Renders nothing.
 */
export default function TimezoneSync() {
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return;
    const value = encodeURIComponent(zone);
    if (document.cookie.split("; ").includes(`${TIMEZONE_COOKIE}=${value}`)) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${TIMEZONE_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  }, []);
  return null;
}
