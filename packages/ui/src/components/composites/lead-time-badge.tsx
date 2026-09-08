import { Truck } from "lucide-react";
import { cn } from "../../lib/cn";

export type LeadTimeBadgeProps = {
  availability: "in_stock" | "made_to_order" | "out_of_stock";
  leadTimeDaysMin: number;
  leadTimeDaysMax: number;
  className?: string;
};

/**
 * Lead-time badge — P2 persona requirement (PRD FR-207/FR-304).
 * Copy mirrors the draft PRD exactly: "In stock — ships in 2–4 days" /
 * "Made to order — ships in 6–8 weeks".
 */
export function LeadTimeBadge({
  availability,
  leadTimeDaysMin,
  leadTimeDaysMax,
  className,
}: LeadTimeBadgeProps) {
  const madeToOrder = availability === "made_to_order";
  const weeksMin = Math.max(1, Math.round(leadTimeDaysMin / 7));
  const weeksMax = Math.max(weeksMin, Math.round(leadTimeDaysMax / 7));
  const label =
    availability === "out_of_stock"
      ? "Out of stock"
      : madeToOrder
        ? `Made to order — ships in ${weeksMin}–${weeksMax} weeks`
        : `In stock — ships in ${leadTimeDaysMin}–${leadTimeDaysMax} days`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-medium",
        madeToOrder ? "bg-bg-3 text-ink-2" : "bg-sage/15 text-ink-2",
        availability === "out_of_stock" && "bg-bg-2 text-muted",
        className,
      )}
    >
      <Truck className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
