"use client";

import Link from "next/link";
import { Badge } from "../badge";
import { MediaImage } from "./media-image";
import { PriceBlock } from "./price-block";
import { cn } from "../../lib/cn";

/** Structural card shape — compatible with commerce ProductCardDto without a package dep (PRD §4.1). */
export type ProductCardProduct = {
  slug: string;
  title: string;
  materialLine: string | null;
  imageUrl: string;
  imageAlt: string;
  hoverImageUrl: string | null;
  badge: "new" | "sale" | "low_stock" | null;
  availability: "in_stock" | "made_to_order" | "out_of_stock";
  leadTimeDaysMin: number;
  leadTimeDaysMax: number;
};

export type ProductCardProps = {
  product: ProductCardProduct;
  formattedPrice: string;
  formattedCompareAt?: string | null;
  quickAdd?: React.ReactNode;
  priority?: boolean;
  className?: string;
};

/**
 * PLP product card (PRD FR-206/FR-207): one accessible link, hover-swap image,
 * badge, material line, price with compare-at strikethrough, optional quick-add.
 * The quick-add button is OUTSIDE the link semantics (a11y note in FR-206).
 */
export function ProductCard({
  product,
  formattedPrice,
  formattedCompareAt,
  quickAdd,
  priority = false,
  className,
}: ProductCardProps) {
  const madeToOrder = product.availability === "made_to_order";
  const weeksMin = Math.max(1, Math.round(product.leadTimeDaysMin / 7));
  const weeksMax = Math.max(weeksMin, Math.round(product.leadTimeDaysMax / 7));

  return (
    <article className={cn("group relative flex flex-col gap-3", className)}>
      <div className="relative overflow-hidden rounded-image bg-bg-2">
        <Link
          href={`/products/${product.slug}`}
          className="block focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          aria-label={`${product.title} — view details`}
        >
          <div className="relative aspect-[4/5]">
            <MediaImage
              src={product.imageUrl}
              alt={product.imageAlt}
              width={800}
              height={1000}
              priority={priority}
              className="absolute inset-0 transition-opacity duration-slow ease-brand group-hover:opacity-0"
            />
            {product.hoverImageUrl ? (
              <MediaImage
                src={product.hoverImageUrl}
                alt=""
                width={800}
                height={1000}
                className="absolute inset-0 opacity-0 transition-opacity duration-slow ease-brand group-hover:opacity-100"
              />
            ) : null}
          </div>
        </Link>
        <div className="absolute left-3 top-3 flex gap-1.5">
          {product.badge === "new" ? <Badge variant="new">New</Badge> : null}
          {product.badge === "sale" ? <Badge variant="sale">Sale</Badge> : null}
          {product.badge === "low_stock" ? <Badge variant="lowStock">Low stock</Badge> : null}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="font-display text-lg leading-snug">
          <Link href={`/products/${product.slug}`} className="hover:text-accent-2">
            {product.title}
          </Link>
        </h3>
        {product.materialLine ? (
          <p className="text-sm text-muted">{product.materialLine}</p>
        ) : null}
        <PriceBlock
          formattedPrice={formattedPrice}
          formattedCompareAt={formattedCompareAt}
        />
        <p className="text-xs text-muted">
          {product.availability === "out_of_stock"
            ? "Currently unavailable"
            : madeToOrder
              ? `Made to order — ships in ${weeksMin}–${weeksMax} weeks`
              : `In stock — ships in ${product.leadTimeDaysMin}–${product.leadTimeDaysMax} days`}
        </p>
      </div>

      {quickAdd ? <div className="mt-auto">{quickAdd}</div> : null}
    </article>
  );
}
