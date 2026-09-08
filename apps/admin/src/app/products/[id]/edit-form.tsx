"use client";

import { useState, useTransition } from "react";
import { Button } from "@scandihaven/ui/button";
import { Input } from "@scandihaven/ui/input";
import { Label } from "@scandihaven/ui/label";
import { updateProductAction } from "@/actions/products";

type ProductForm = {
  id: string;
  title: string;
  status: "draft" | "active" | "archived";
  seoTitle: string;
  seoDescription: string;
};

export function ProductEditForm({
  product,
  variants,
}: {
  product: ProductForm;
  variants: Array<{ sku: string; color: string | null; priceMinor: number; qtyOnHand: number }>;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setMessage(null);
    startTransition(async () => {
      const result = await updateProductAction({
        id: product.id,
        title: String(data.get("title") ?? ""),
        status: String(data.get("status") ?? "draft"),
        priceMinor: Math.round(Number(data.get("price") ?? 0) * 100),
        stockDelta: Number(data.get("stockDelta") ?? 0),
        seoTitle: String(data.get("seoTitle") ?? ""),
        seoDescription: String(data.get("seoDescription") ?? ""),
      });
      setMessage(result.ok ? "Saved." : result.error.message);
    });
  };

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5 rounded-card border border-line bg-bg p-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={product.title} required minLength={2} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={product.status}
            className="h-11 rounded-card border border-input bg-transparent px-3 text-base"
          >
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="price">Price (EUR)</Label>
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={(variants[0]?.priceMinor ?? 0) / 100}
            required
          />
        </div>
      </div>

      <div className="rounded-card border border-line bg-bg-2 p-4">
        <p className="text-sm font-medium">Variants</p>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {variants.map((variant) => (
            <li key={variant.sku} className="flex justify-between">
              <span>
                {variant.sku}
                {variant.color ? ` — ${variant.color}` : ""}
              </span>
              <span className="tabular-nums">
                stock: {variant.qtyOnHand} · {variant.priceMinor / 100} EUR
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-col gap-1.5">
          <Label htmlFor="stockDelta">Stock adjustment (first variant)</Label>
          <Input id="stockDelta" name="stockDelta" type="number" defaultValue={0} />
          <p className="text-xs text-muted">
            Positive adds units to Aalborg; negative removes. Movements are audit-logged.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="seoTitle">SEO title</Label>
        <Input id="seoTitle" name="seoTitle" defaultValue={product.seoTitle} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="seoDescription">SEO description</Label>
        <Input id="seoDescription" name="seoDescription" defaultValue={product.seoDescription} />
      </div>

      {message ? (
        <p role="status" className="text-sm text-ink-2">
          {message}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
