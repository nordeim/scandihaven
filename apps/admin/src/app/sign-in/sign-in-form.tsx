"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@scandihaven/auth/client";
import { Button } from "@scandihaven/ui/button";
import { Input } from "@scandihaven/ui/input";
import { Label } from "@scandihaven/ui/label";

export function AdminSignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const { error: signInError } = await authClient.signIn.email({
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
      });
      if (signInError) {
        setError(signInError.message ?? "Sign-in failed.");
        return;
      }
      const redirect = searchParams.get("redirect") ?? "/";
      router.push(redirect);
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-md px-5 py-28">
      <h1 className="font-display text-3xl">Scandi Haven Admin</h1>
      <p className="mt-2 text-sm text-muted">Staff sign-in. 2FA lands with Phase 1 (PRD §9.1).</p>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
