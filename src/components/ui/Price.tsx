import { cn } from "@/lib/cn";
import { discountPercent, formatPrice } from "@/lib/format";

/** Price with optional struck-through compare-at price (sale). */
export function Price({
  price,
  compareAt,
  className,
  size = "md",
}: {
  price: number;
  compareAt?: number | null;
  className?: string;
  size?: "md" | "lg";
}) {
  const onSale = discountPercent(price, compareAt) > 0;
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2", size === "lg" ? "text-xl" : "text-sm", className)}>
      <span className={cn("font-semibold tabular-nums", onSale && "text-sale")}>
        {onSale ? <span className="sr-only">Sale price </span> : <span className="sr-only">Price </span>}
        {formatPrice(price)}
      </span>
      {onSale && compareAt ? (
        <span className="text-muted line-through tabular-nums">
          <span className="sr-only">Original price </span>
          {formatPrice(compareAt)}
        </span>
      ) : null}
    </p>
  );
}
