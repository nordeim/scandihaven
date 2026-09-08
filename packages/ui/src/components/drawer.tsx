"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

/**
 * Side drawer (mini-cart, mobile nav) on Radix Dialog primitives (PRD §10.3).
 * Focus-trapped, Esc/scrim close, body scroll locked — FR-102/FR-401 a11y floor.
 */
export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

export function DrawerContent({
  className,
  children,
  side = "right",
  title,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  side?: "right" | "left";
  title: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] transition-opacity duration-base ease-brand" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          "fixed inset-y-0 z-50 flex h-full w-full max-w-md flex-col bg-bg shadow-lg transition-transform duration-slow ease-brand",
          side === "right" ? "right-0" : "left-0",
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        {children}
        <DialogPrimitive.Close
          aria-label="Close"
          className="absolute right-4 top-4 rounded-pill p-1 text-ink-2 transition-colors hover:bg-bg-2 hover:text-ink"
        >
          <X className="size-5" aria-hidden />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
