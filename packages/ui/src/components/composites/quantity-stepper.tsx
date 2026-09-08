"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "../../lib/cn";

export type QuantityStepperProps = {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
};

/** Accessible quantity control (PRD §10.3) — keyboard operable, labelled. */
export function QuantityStepper({
  value,
  min = 1,
  max = 99,
  onChange,
  disabled = false,
  label = "Quantity",
  className,
}: QuantityStepperProps) {
  return (
    <div
      className={cn("inline-flex h-11 items-center border border-line rounded-card", className)}
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        aria-label={`Decrease ${label.toLowerCase()}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-full w-10 items-center justify-center text-ink-2 transition-colors hover:bg-bg-2 disabled:opacity-40"
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <span aria-live="polite" className="w-10 text-center text-md tabular-nums">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label.toLowerCase()}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-full w-10 items-center justify-center text-ink-2 transition-colors hover:bg-bg-2 disabled:opacity-40"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
