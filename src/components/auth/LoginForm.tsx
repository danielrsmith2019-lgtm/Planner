"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { safeNextPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "./AuthShell";
import FormField, { FormError, OrDivider } from "./FormField";
import GoogleButton from "./GoogleButton";
import { signInWithGoogle } from "./oauth";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error"));
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setBusy(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    const message = await signInWithGoogle(next);
    if (message) {
      setError(message);
      setBusy(false);
    }
  }

  const signupHref = next === "/" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`;

  return (
    <AuthShell
      tagline="The daily planner that knows what your goals are."
      footer={
        <>
          New here?{" "}
          <Link href={signupHref} className="inline-flex min-h-11 items-center font-semibold text-bc-blue">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleButton label="Continue with Google" onClick={handleGoogle} disabled={busy} />
      <OrDivider />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate={false}>
        <FormField
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <FormError message={error} />
        <button type="submit" className="bc-btn-primary min-h-11" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
