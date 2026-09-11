"use client";

import { useState, useTransition } from "react";
import { Button } from "@scandihaven/ui/button";
import { Input } from "@scandihaven/ui/input";
import { subscribeAction } from "@/actions/newsletter";

/**
 * Newsletter signup (PRD FR-107). Used from the homepage section (default
 * `source`) and the footer (R8-4): `idPrefix` keeps the two instances' DOM
 * ids/labels distinct, `source` lands in `newsletter_subscriber.source` so
 * the signup origin stays analysable.
 */
export function NewsletterForm({
  source = "homepage",
  idPrefix = "newsletter",
  compact = false,
}: {
  source?: string;
  idPrefix?: string;
  compact?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await subscribeAction({ email, source });
      setMessage(
        result.ok
          ? result.data.status === "already-subscribed"
            ? "You are already on the list."
            : "Thank you — please check your inbox to confirm."
          : result.error.message,
      );
    });
  };

  return (
    <form onSubmit={onSubmit} className={`${compact ? "mt-4" : "mt-6"} flex flex-col gap-3 sm:flex-row`} noValidate={false}>
      <label htmlFor={`${idPrefix}-email`} className="sr-only">
        Email address
      </label>
      <Input
        id={`${idPrefix}-email`}
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1"
        autoComplete="email"
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Subscribing…" : "Subscribe"}
      </Button>
      {message ? (
        <p role="status" className="text-sm text-ink-2 sm:absolute sm:mt-14">
          {message}
        </p>
      ) : null}
    </form>
  );
}
