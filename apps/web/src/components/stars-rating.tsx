import { Star } from "lucide-react";

export function StarsRating({
  rating,
  small = false,
}: {
  rating: number;
  small?: boolean;
}) {
  const size = small ? "size-3.5" : "size-4";
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`Rated ${rating.toFixed(1)} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((step) => (
        <Star
          key={step}
          aria-hidden
          className={`${size} ${
            step <= Math.round(rating) ? "fill-wood text-wood" : "text-line"
          }`}
        />
      ))}
    </span>
  );
}
