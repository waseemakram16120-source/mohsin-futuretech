"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { deleteCategory, saveCategory, uploadCategoryImage, type CatalogResult } from "@/app/admin/catalog-actions";
import { FormMessage, inputClasses } from "@/components/forms/Field";
import { ProductImage } from "@/components/product/ProductImage";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { AdminCategory } from "@/lib/admin/catalog";
import { slugify } from "@/lib/admin/schemas";
import { cn } from "@/lib/cn";

function CategoryForm({ category, onDone }: { category: AdminCategory | null; onDone: (r: CatalogResult) => void }) {
  const uid = useId();
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const [description, setDescription] = useState(category?.description ?? "");
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      noValidate
      aria-label={category ? `Edit ${category.name}` : "New category"}
      className="space-y-4 rounded-card border border-stone bg-surface p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        start(async () => {
          const r = await saveCategory({ id: category?.id ?? null, name, slug, description, sortOrder, isActive });
          setErrors(r.errors ?? {});
          setMessage(r.ok ? null : r.message);
          if (r.ok) onDone(r);
        });
      }}
    >
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-name`} className="text-sm font-medium">
            Name
          </label>
          <input
            id={`${uid}-name`}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            aria-invalid={Boolean(errors.name)}
            className={cn(inputClasses(Boolean(errors.name)), "mt-1.5")}
          />
          {errors.name ? <p className="mt-1 text-sm text-sale">{errors.name}</p> : null}
        </div>
        <div>
          <label htmlFor={`${uid}-slug`} className="text-sm font-medium">
            Web address
          </label>
          <input
            id={`${uid}-slug`}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            aria-invalid={Boolean(errors.slug)}
            className={cn(inputClasses(Boolean(errors.slug)), "mt-1.5 font-mono")}
          />
          {errors.slug ? <p className="mt-1 text-sm text-sale">{errors.slug}</p> : null}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${uid}-desc`} className="text-sm font-medium">
            Description <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea id={`${uid}-desc`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={cn(inputClasses(Boolean(errors.description)), "mt-1.5 h-auto py-3")} />
        </div>
        <div>
          <label htmlFor={`${uid}-sort`} className="text-sm font-medium">
            Position in menus (lower first)
          </label>
          <input id={`${uid}-sort`} inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={cn(inputClasses(Boolean(errors.sortOrder)), "mt-1.5")} />
        </div>
        <label className="flex items-end gap-2 pb-3 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-4 accent-ink" />
          Visible in the shop
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save category"}
        </Button>
        <Button variant="ghost" onClick={() => onDone({ ok: false, message: "" })}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function CategoryManager({ categories }: { categories: AdminCategory[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [notice, setNotice] = useState<CatalogResult | null>(null);
  const [pending, start] = useTransition();

  const done = (r: CatalogResult) => {
    setEditing(null);
    if (r.message) setNotice(r);
    if (r.ok) router.refresh();
  };
  const run = (fn: () => Promise<CatalogResult>) =>
    start(async () => {
      const r = await fn();
      setNotice(r);
      if (r.ok) router.refresh();
    });

  return (
    <div className="space-y-5">
      {notice?.message ? <FormMessage tone={notice.ok ? "success" : "error"} testId="category-notice">{notice.message}</FormMessage> : null}
      {editing === "new" ? <CategoryForm category={null} onDone={done} /> : <Button onClick={() => setEditing("new")}>Add category</Button>}
      <ul className="space-y-3" data-testid="category-list">
        {categories.map((c) =>
          editing === c.id ? (
            <li key={c.id}>
              <CategoryForm category={c} onDone={done} />
            </li>
          ) : (
            <li key={c.id} className="flex flex-wrap items-center gap-4 rounded-card border border-stone bg-surface p-4" data-testid="category-row">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-xs bg-sand">
                {c.imageUrl ? <ProductImage src={c.imageUrl} alt="" fill sizes="64px" className="object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {c.name} {c.isActive ? null : <Badge>Hidden</Badge>}
                </p>
                <p className="text-xs text-muted">
                  /collections/{c.slug} · {c.productCount} product{c.productCount === 1 ? "" : "s"} · position {c.sortOrder}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <button type="button" className="underline underline-offset-4" onClick={() => setEditing(c.id)} aria-label={`Edit ${c.name}`}>
                  Edit
                </button>
                <label className="cursor-pointer underline underline-offset-4">
                  Photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    aria-label={`Upload photo for ${c.name}`}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const data = new FormData();
                      data.set("image", f);
                      run(() => uploadCategoryImage(c.id, data));
                      e.target.value = "";
                    }}
                  />
                </label>
                {c.productCount === 0 ? (
                  <button
                    type="button"
                    className="text-sale underline underline-offset-4 disabled:opacity-50"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm(`Delete the ${c.name} category?`)) run(() => deleteCategory(c.id));
                    }}
                    aria-label={`Delete ${c.name}`}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
