import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/ui";
import { inputClasses } from "@/components/forms/Field";
import { ProductImage } from "@/components/product/ProductImage";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { requireAdmin } from "@/lib/admin/auth";
import { listAdminCategories, listProducts } from "@/lib/admin/catalog";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Products" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminProductsPage({ searchParams }: Props) {
  await requireAdmin("/admin/products");
  const raw = await searchParams;
  const one = (k: string) => (typeof raw[k] === "string" && raw[k] ? (raw[k] as string) : undefined);
  const q = one("q")?.slice(0, 60);
  const category = one("category");
  const status = one("status") === "active" || one("status") === "archived" ? (one("status") as "active" | "archived") : undefined;
  const page = Math.max(1, Math.min(1000, Number(one("page")) || 1));
  const [{ rows, total, pageSize }, categories] = await Promise.all([
    listProducts({ q, category: validCategoryId(category), status, page }),
    listAdminCategories(),
  ]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const filtered = Boolean(q || category || status);
  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (category) sp.set("category", category);
    if (status) sp.set("status", status);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return `/admin/products${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <AdminPageHeader title="Products" description={`${total} product${total === 1 ? "" : "s"}${filtered ? " match" : ""}.`} actions={<ButtonLink href="/admin/products/new">Add product</ButtonLink>} />

      <form method="get" role="search" aria-label="Filter products" className="mb-6 grid gap-3 rounded-card border border-stone bg-surface p-4 sm:grid-cols-[1fr_12rem_10rem_auto]">
        <div>
          <label htmlFor="p-q" className="text-xs font-medium text-ink-soft">
            Search
          </label>
          <input id="p-q" name="q" defaultValue={q} placeholder="Product name" className={inputClasses(false)} />
        </div>
        <div>
          <label htmlFor="p-cat" className="text-xs font-medium text-ink-soft">
            Category
          </label>
          <select id="p-cat" name="category" defaultValue={category ?? ""} className={inputClasses(false)}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="p-status" className="text-xs font-medium text-ink-soft">
            Status
          </label>
          <select id="p-status" name="status" defaultValue={status ?? ""} className={inputClasses(false)}>
            <option value="">All</option>
            <option value="active">In shop</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" className="h-12">
            Apply
          </Button>
          {filtered ? (
            <ButtonLink href="/admin/products" variant="ghost" className="h-12">
              Clear
            </ButtonLink>
          ) : null}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon="box" title={filtered ? "No products match" : "No products yet"} action={<ButtonLink href="/admin/products/new">Add product</ButtonLink>} />
      ) : (
        <ul className="divide-y divide-stone rounded-card border border-stone bg-surface" data-testid="admin-product-list">
          {rows.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/products/${p.id}`} className="flex items-center gap-4 p-3 hover:bg-sand/40 sm:p-4" data-testid="admin-product-row">
                <div className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-xs bg-sand">
                  {p.image ? <ProductImage src={p.image} alt="" fill sizes="48px" className="object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-xs text-muted">
                    {p.category ?? "No category"} · {p.variants} variant{p.variants === 1 ? "" : "s"} · {p.stock} in stock
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {!p.isActive ? <Badge>Archived</Badge> : null}
                    {p.isFeatured ? <Badge tone="dark">Featured</Badge> : null}
                    {p.isNewArrival ? <Badge tone="new">New</Badge> : null}
                    {p.compareAtPrice ? <Badge tone="sale">Sale</Badge> : null}
                    {p.lowVariants > 0 ? <Badge tone="warning">{p.lowVariants} low</Badge> : null}
                    {p.image ? null : <Badge tone="warning">No photo</Badge>}
                  </div>
                </div>
                <p className="text-right text-sm font-semibold tabular-nums">{formatPrice(p.basePrice)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href(page - 1)} className="underline">← Previous</Link> : <span />}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={href(page + 1)} className="underline">Next →</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}

function validCategoryId(id: string | undefined) {
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : undefined;
}
