import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Logo } from "~/components/shared/logo";
import { getSession } from "~/server/better-auth/server";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    // The login page lives in the night world in both themes.
    <main className="dark flex min-h-svh flex-col items-center justify-center gap-8 bg-background px-4 py-10 text-foreground">
      <Logo />
      <div className="w-full max-w-[400px] rounded-lg bg-card p-8">
        <h1 className="type-title">Sign in</h1>
        <p className="mt-2 type-body text-muted-foreground">
          Your portfolio and expenses, in one place.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
