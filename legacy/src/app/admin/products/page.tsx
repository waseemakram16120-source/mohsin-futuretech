/**
 * /admin/products — product management (PDF §5): list, search, add,
 * edit, delete. Live via API, demo via local admin products.
 */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminGet, adminSend } from "@/lib/admin-client";
import { getAdminProducts, saveAdminProducts } from "@/lib/admin-data";
import type { AdminProduct } from "@/lib/admin-types";
import { formatPKR } from "@/lib/constants";
import {
  EmptyState,
  LoadingState,
  PageTitle,
} from "@/components/admin-ui";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    adminGet("/api/admin/products")
      .then((json) => {
        if (json.mode === "live" && Array.isArray(json.products)) {
          setProducts(json.products as AdminProduct[]);
        } else {
          setProducts(getAdminProducts());
        }
      })
      .catch(() => setProducts(getAdminProducts()));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.slug, p.categoryName, ...p.variants.map((v) => v.sku)]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [products, query]);

  async function remove(product: AdminProduct) {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    try {
      const json = await adminSend(`/api/admin/products/${product.id}`, "DELETE");
      if (json.mode === "demo") {
        saveAdminProducts(getAdminProducts().filter((p) => p.id !== product.id));
      }
      setMessage(`"${product.name}" deleted.`);
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not delete the product.");
    }
  }

  if (!products) return <LoadingState label="Loading products…" />;

  return (
    <div>
      <PageTitle
        title="Products"
        subtitle={`${filtered.length} of ${products.length} products`}
        action={
          <Link
            href="/admin/products/new"
            className="rounded bg-[#0f2440] px-4 py-2 text-sm font-medium text-white"
          >
            + Add product
          </Link>
        }
      />

      {message && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </p>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, category or SKU…"
        className="mb-4 w-full max-w-md rounded border bg-white px-3 py-2 text-sm"
      />

      {filtered.length === 0 ? (
        <EmptyState message="No products found." />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p) => {
                const stock = p.variants.reduce((s, v) => s + v.stock, 0);
                return (
                  <tr key={p.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <span className="font-medium">{p.name}</span>
                      <span className="block text-xs text-zinc-500">{p.slug}</span>
                    </td>
                    <td className="px-4 py-3">{p.categoryName}</td>
                    <td className="px-4 py-3 text-right">
                      {formatPKR(p.price)}
                      {p.compareAtPrice ? (
                        <span className="block text-xs text-zinc-400 line-through">
                          {formatPKR(p.compareAtPrice)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={stock <= 5 ? "font-semibold text-red-600" : ""}>
                        {stock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.isActive ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Active</span>
                      ) : (
                        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-700">Hidden</span>
                      )}
                      {p.isFeatured && (
                        <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Featured</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/products/${p.id}`} className="mr-3 text-sky-700 underline">
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => void remove(p)}
                        className="text-red-600 underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
