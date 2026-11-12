import { Suspense } from "react";
import { AuthShellSkeleton } from "@/components/auth/AuthShell";
import LoginForm from "@/components/auth/LoginForm";

export const metadata = { title: "Sign in | Planner" };

// LoginForm reads ?next= and ?error= with useSearchParams, which needs Suspense.
export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShellSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
