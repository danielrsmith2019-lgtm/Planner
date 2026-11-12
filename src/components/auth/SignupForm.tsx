"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { safeNextPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/utils/icons";
import AuthShell from "./AuthShell";
import FormField, { FormError, OrDivider } from "./FormField";
import GoogleButton from "./GoogleButton";
import { signInWithGoogle } from "./oauth";

export const MIN_PASSWORD_LENGTH = 8;

export default function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
    if (password !== confirm) return setError("The passwords don't match.");

    setBusy(true);
    const callback = new URL("/auth/callback", window.location.origin);
    if (next !== "/") callback.searchParams.set("next", next);
    const { data, error: signUpError } = await createClient().auth.signUp({
      email,
      password,
      options: { data: { display_name: name.trim() }, emailRedirectTo: callback.toString() },
    });

    if (signUpError) {
      setError(signUpError.message);
      setBusy(false);
      return;
    }
    // Supabase returns a user with no identities when the email is already registered.
    if (data.user && data.user.identities?.length === 0) {
      setError("An account with this email already exists. Try signing in.");
      setBusy(false);
      return;
    }
    if (data.session) {
      // Email confirmation is off: signed in already.
      router.replace(next);
      router.refresh();
      return;
    }
    setSentTo(email);
    setBusy(false);
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

  if (sentTo) {
    return (
      <AuthShell tagline="One more step.">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-bc-blue-light text-bc-blue">
            <Icon icon="mail" size={28} />
          </span>
          <h2 className="bc-section-title">Check your email</h2>
          <p className="bc-label">
            We sent a confirmation link to <span className="font-semibold text-fg">{sentTo}</span>. Open it on this
            device to finish signing up.
          </p>
          <Link href="/login" className="bc-btn-secondary mt-2 min-h-11">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  const loginHref = next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;

  return (
    <AuthShell
      tagline="Set a goal, plan today around it."
      footer={
        <>
          Already have an account?{" "}
          <Link href={loginHref} className="inline-flex min-h-11 items-center font-semibold text-bc-blue">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton label="Sign up with Google" onClick={handleGoogle} disabled={busy} />
      <OrDivider />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField id="name" label="Name" autoComplete="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
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
          autoComplete="new-password"
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <FormField
          id="confirm"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <FormError message={error} />
        <button type="submit" className="bc-btn-primary min-h-11" disabled={busy}>
          {busy ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
