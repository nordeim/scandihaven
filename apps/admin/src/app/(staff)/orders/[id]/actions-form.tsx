"use client";

import { useState, useTransition } from "react";
import { Button } from "@scandihaven/ui/button";
import { transitionOrderAction } from "@/actions/orders";

const ACTIONS: Array<{ event: string; label: string }> = [
  { event: "start_production", label: "Start production" },
  { event: "mark_partially_shipped", label: "Split-ship" },
  { event: "mark_shipped", label: "Mark shipped" },
  { event: "mark_delivered", label: "Mark delivered" },
  { event: "close", label: "Close" },
  { event: "cancel", label: "Cancel" },
];

/** Order actions (FR-807) — the server action rejects illegal transitions. */
export function OrderActions({ orderId, status }: { orderId: string; status: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (event: string) => {
    setMessage(null);
    startTransition(async () => {
      const result = await transitionOrderAction({ orderId, event, from: status });
      setMessage(result.ok ? `Done — now ${result.data.status}.` : result.error.message);
    });
  };

  return (
    <section aria-label="Order actions" className="rounded-card border border-line bg-bg p-6">
      <h2 className="font-display text-xl">Actions</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {ACTIONS.map((action) => (
          <Button
            key={action.event}
            variant={action.event === "cancel" ? "outline" : "secondary"}
            size="sm"
            disabled={isPending}
            onClick={() => run(action.event)}
          >
            {action.label}
          </Button>
        ))}
      </div>
      {message ? (
        <p role="status" className="mt-3 text-sm text-ink-2">
          {message}
        </p>
      ) : null}
    </section>
  );
}
