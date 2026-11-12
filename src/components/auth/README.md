# src/components/auth

Sign-in and sign-up UI.

Belongs here:
- LoginForm, SignupForm (Client Components rendered by /login and /signup)
- AuthShell, FormField, GoogleButton, and the Google OAuth helper

Rules: Supabase browser client only (src/lib/supabase/client.ts), created inside
event handlers. Never import services or Prisma. 44px inputs and buttons.
