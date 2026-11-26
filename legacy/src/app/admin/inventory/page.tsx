/**
 * /admin/inventory — stock by variation (PDF §5): track stock per
 * size/colour, low-stock indicators, and stock adjustment controls
 * (+/− and set value). Live via API, demo via the local catalogue.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminGet, adminSend } from "@/lib/admin-client";
import { getAdminProducts, saveAdminProducts } from "@/lib/admin-data";
import type { AdminProduct } from "@/lib/admin-types";
import {
  EmptyState,
  LoadingState,
  PageTitle,
} from "@/components/admin-ui";

interface InventoryRow {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  stock: number;
}

export default function AdminInventoryPage() {
  const [rows, setRows] = useState<InventoryRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    adminGet("/api/admin/inventory")
      .then((json) => {
        if (json.mode === "live" && Array.isArray(json.inventory)) {
          setRows(json.inventory as InventoryRow[]);
        } else {
          setRows(
            getAdminProducts().flatMap((p) =>
              p.variants.map((v) => ({
                id: v.id,
                productId: p.id,
                productName: p.name,
                sku: v.sku,
                size: v.size,
                color: v.color,
                stock: v.stock,
              })),
            ),
          );
        }
      })
      .catch(() =>
        setRows(
          getAdminProducts().flatMap((p) =>
            p.variants.map((v) => ({
              id: v.id,
              productId: p.id,
              productName: p.name,
              sku: v.sku,
              size: v.size,
              color: v.color,
              stock: v.stock,
            })),
          ),
        ),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyLow && r.stock > 5) return false;
      if (q && ![r.productName, r.sku, r.size, r.color].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, onlyLow]);

  async function setStock(row: InventoryRow, next: number) {
    const stock = Math.max(0, Math.floor(next));
    try {
      const json = await adminSend("/api/admin/inventory", "PATCH", {
        variantId: row.id,
        stock,
      });
      if (json.mode === "demo") {
        saveAdminProducts(
          getAdminProducts().map((p: AdminProduct) =>
            p.id === row.productId
              ? {
                  ...p,
                  variants: p.variants.map((v) =>
                    v.id === row.id ? { ...v, stock } : v,
                  ),
                }
              : p,
          ),
        );
      }
      setRows((prev) =>
        (prev ?? []).map((r) => (r.id === row.id ? { ...r, stock } : r)),
      );
      setMessage(`Stock for ${row.sku} set to ${stock}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update the stock.");
    }
  }

  if (!rows) return <LoadingState label="Loading inventory…" />;

  return (
    <div>
      <PageTitle
        title="Inventory"
        subtitle={`${rows.filter((r) => r.stock <= 5).length} low-stock variants (5 or fewer)`}
      />

      {message && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search product, SKU, size or colour…"
          className="w-full max-w-md rounded border bg-white px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 rounded border bg-white px-3 py-2 text-sm">
          <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
          Low stock only
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No variants match these filters." />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Variant</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3">Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium">{r.productName}</td>
                  <td className="px-4 py-3">{r.size} / {r.color}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.sku}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        r.stock === 0
                          ? "bg-red-100 text-red-800"
                          : r.stock <= 5
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {r.stock === 0 ? "Out of stock" : `${r.stock} left`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => void setStock(r, r.stock - 1)} className="rounded border px-2 py-1" aria-label="Decrease stock">−</button>
                      <input
                        value={r.stock}
                        onChange={(e) => void setStock(r, Number(e.target.value) || 0)}
                        type="number"
                        min={0}
                        className="w-16 rounded border px-2 py-1 text-center text-sm"
                        aria-label="Set stock"
                      />
                      <button type="button" onClick={() => void setStock(r, r.stock + 1)} className="rounded border px-2 py-1" aria-label="Increase stock">+</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
