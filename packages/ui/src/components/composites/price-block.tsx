import { Badge } from "../badge";
import { cn } from "../../lib/cn";

export type PriceBlockProps = {
  /** Preformatted per locale with Intl in the app (PRD §7.2 — integers here, format at edge). */
  formattedPrice: string;
  formattedCompareAt?: string | null;
  showSaleBadge?: boolean;
  taxLabel?: string;
  className?: string;
};

export function PriceBlock({
  formattedPrice,
  formattedCompareAt,
  showSaleBadge = true,
  taxLabel,
  className,
}: PriceBlockProps) {
  return (
    <div className={cn("flex flex-wrap items-baseline gap-2", className)}>
      <span className="text-xl font-medium tabular-nums text-ink">{formattedPrice}</span>
      {formattedCompareAt ? (
        <>
          <span className="text-md text-muted line-through tabular-nums">{formattedCompareAt}</span>
          {showSaleBadge ? <Badge variant="sale">Sale</Badge> : null}
        </>
      ) : null}
      {taxLabel ? <span className="w-full text-xs text-muted">{taxLabel}</span> : null}
    </div>
  );
}
