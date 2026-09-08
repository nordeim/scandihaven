"use client";

import Image from "next/image";
import { cn } from "../../lib/cn";

export type MediaImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
};

/**
 * next/image wrapper enforcing the image budget (PRD §10.5):
 * explicit dimensions, responsive sizes, AVIF/WebP automatic, sharp corners.
 */
export function MediaImage({
  src,
  alt,
  width,
  height,
  sizes = "(min-width: 1024px) 25vw, 100vw",
  priority = false,
  className,
}: MediaImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      className={cn("h-auto w-auto object-cover rounded-image", className)}
    />
  );
}
