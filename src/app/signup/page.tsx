import { Suspense } from "react";
import { AuthShellSkeleton } from "@/components/auth/AuthShell";
import SignupForm from "@/components/auth/SignupForm";

export const metadata = { title: "Create account | Planner" };

// SignupForm reads ?next= with useSearchParams, which needs Suspense.
export default function SignupPage() {
  return (
    <Suspense fallback={<AuthShellSkeleton />}>
      <SignupForm />
    </Suspense>
  );
}
