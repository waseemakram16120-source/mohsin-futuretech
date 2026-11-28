"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteProduct, setProductActive, type CatalogResult } from "@/app/admin/catalog-actions";
import { FormMessage } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";

export function ProductDanger({ productId, isActive, hasOrders }: { productId: string; isActive: boolean; hasOrders: boolean }) {
  const router = useRouter();
  const [result, setResult] = useState<CatalogResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="rounded-card border border-stone bg-surface p-5 sm:p-6" aria-label="Archive or delete">
      <h2 className="font-display text-xl">Archive or delete</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Archiving hides the product from the shop but keeps it for reports and past orders.
        {hasOrders ? " This product has orders, so it can't be deleted." : " A product that was never ordered can be deleted permanently."}
      </p>
      {result ? (
        <div className="mt-3">
          <FormMessage tone={result.ok ? "success" : "error"}>{result.message}</FormMessage>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await setProductActive(productId, !isActive);
              setResult(r);
              if (r.ok) router.refresh();
            })
          }
        >
          {isActive ? "Archive product" : "Put back in the shop"}
        </Button>
        {!hasOrders ? (
          <Button
            variant="secondary"
            className="border-sale text-sale hover:bg-sale hover:text-surface"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Delete this product permanently? This cannot be undone.")) return;
              start(async () => {
                const r = await deleteProduct(productId);
                setResult(r);
                if (r.ok) router.push("/admin/products");
              });
            }}
          >
            Delete permanently
          </Button>
        ) : null}
      </div>
    </section>
  );
}
