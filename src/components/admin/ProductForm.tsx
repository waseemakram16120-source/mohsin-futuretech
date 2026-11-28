"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type ReactNode } from "react";
import { saveProduct } from "@/app/admin/catalog-actions";
import { FormMessage, inputClasses } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { AdminCategory, AdminProductEdit } from "@/lib/admin/catalog";
import { slugify } from "@/lib/admin/schemas";
import { cn } from "@/lib/cn";
import { AUDIENCES, type Audience } from "@/lib/domain";

interface VariantDraft {
  key: string;
  id: string | null;
  size: string;
  color: string;
  colorHex: string;
  sku: string;
  priceOverride: string;
  stock: string;
  currentStock: number | null;
  isActive: boolean;
}

const AUDIENCE_LABEL: Record<Audience, string> = { men: "Men", women: "Women", unisex: "Unisex" };
let keySeq = 0;
const newKey = () => `v${++keySeq}`;

function L({ htmlFor, children, optional }: { htmlFor: string; children: ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium">
      {children}
      {optional ? <span className="font-normal text-muted"> (optional)</span> : null}
    </label>
  );
}

function Err({ id, msg }: { id: string; msg?: string }) {
  return msg ? (
    <p id={id} className="mt-1 flex items-center gap-1 text-sm text-sale">
      <Icon name="alert" className="size-3.5 shrink-0" /> {msg}
    </p>
  ) : null;
}

/** Add / edit a product with its sizes, colours, SKUs and opening stock. */
export function ProductForm({ product, categories }: { product: AdminProductEdit | null; categories: AdminCategory[] }) {
  const router = useRouter();
  const uid = useId();
  const id = (f: string) => `${uid}-${f}`;
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [audience, setAudience] = useState<Audience>(product?.audience ?? "unisex");
  const [description, setDescription] = useState(product?.description ?? "");
  const [details, setDetails] = useState((product?.details ?? []).join("\n"));
  const [basePrice, setBasePrice] = useState(product ? String(product.basePrice) : "");
  const [compareAt, setCompareAt] = useState(product?.compareAtPrice ? String(product.compareAtPrice) : "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [isNew, setIsNew] = useState(product?.isNewArrival ?? true);
  const [variants, setVariants] = useState<VariantDraft[]>(
    product?.variants.length
      ? product.variants.map((v) => ({
          key: newKey(),
          id: v.id,
          size: v.size,
          color: v.color,
          colorHex: v.colorHex,
          sku: v.sku,
          priceOverride: v.priceOverride ? String(v.priceOverride) : "",
          stock: "0",
          currentStock: v.stock,
          isActive: v.isActive,
        }))
      : [{ key: newKey(), id: null, size: "", color: "", colorHex: "#1F2937", sku: "", priceOverride: "", stock: "0", currentStock: null, isActive: true }],
  );

  // Short random tag so auto-made SKUs of similarly named products never clash.
  const [skuTag] = useState(() => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(3));
    return Array.from(bytes, (b) => chars[b % chars.length]).join("");
  });
  const setVariant = (key: string, patch: Partial<VariantDraft>) => setVariants((vs) => vs.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  const suggestSku = (v: VariantDraft) => {
    const base = slugify(slug || name).split("-").slice(0, 3).join("-").toUpperCase();
    const part = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 6);
    return [base, part(v.size), part(v.color), skuTag].filter(Boolean).join("-");
  };

  const submit = () => {
    setResult(null);
    const payload = {
      name,
      slug,
      categoryId,
      audience,
      description,
      details,
      basePrice,
      compareAtPrice: compareAt,
      isActive,
      isFeatured,
      isNewArrival: isNew,
      variants: variants.map((v) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        colorHex: v.colorHex,
        sku: v.sku || suggestSku(v),
        priceOverride: v.priceOverride,
        stock: v.id ? 0 : v.stock || "0",
        isActive: v.isActive,
      })),
    };
    start(async () => {
      const r = await saveProduct(product?.id ?? null, payload);
      setErrors(r.errors ?? {});
      setResult({ ok: r.ok, message: r.message });
      if (r.ok && !product && r.id) router.push(`/admin/products/${r.id}?created=1`);
      else if (r.ok) router.refresh();
      else window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const e = errors;
  const box = "rounded-card border border-stone bg-surface p-5 sm:p-6";
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        submit();
      }}
      noValidate
      className="space-y-6"
      aria-label={product ? "Edit product" : "New product"}
    >
      {result ? <FormMessage tone={result.ok ? "success" : "error"} testId="product-message">{result.message}</FormMessage> : null}

      <section className={box} aria-labelledby={id("basics")}>
        <h2 id={id("basics")} className="font-display text-xl">
          Basics
        </h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <L htmlFor={id("name")}>Product name</L>
            <input
              id={id("name")}
              value={name}
              onChange={(ev) => {
                setName(ev.target.value);
                if (!slugTouched) setSlug(slugify(ev.target.value));
              }}
              aria-invalid={Boolean(e.name)}
              aria-describedby={e.name ? id("name-err") : undefined}
              className={cn(inputClasses(Boolean(e.name)), "mt-1.5")}
            />
            <Err id={id("name-err")} msg={e.name} />
          </div>
          <div className="sm:col-span-2">
            <L htmlFor={id("slug")}>Web address</L>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="shrink-0 text-sm text-muted">/products/</span>
              <input
                id={id("slug")}
                value={slug}
                onChange={(ev) => {
                  setSlugTouched(true);
                  setSlug(ev.target.value);
                }}
                aria-invalid={Boolean(e.slug)}
                aria-describedby={e.slug ? id("slug-err") : undefined}
                className={cn(inputClasses(Boolean(e.slug)), "font-mono")}
              />
            </div>
            <Err id={id("slug-err")} msg={e.slug} />
          </div>
          <div>
            <L htmlFor={id("category")}>Category</L>
            <select id={id("category")} value={categoryId} onChange={(ev) => setCategoryId(ev.target.value)} className={cn(inputClasses(false), "mt-1.5")}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.isActive ? "" : " (hidden)"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <L htmlFor={id("audience")}>Department</L>
            <select id={id("audience")} value={audience} onChange={(ev) => setAudience(ev.target.value as Audience)} className={cn(inputClasses(false), "mt-1.5")}>
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {AUDIENCE_LABEL[a]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <L htmlFor={id("description")}>Description</L>
            <textarea id={id("description")} rows={4} value={description} onChange={(ev) => setDescription(ev.target.value)} className={cn(inputClasses(Boolean(e.description)), "mt-1.5 h-auto py-3")} />
            <Err id={id("description-err")} msg={e.description} />
          </div>
          <div className="sm:col-span-2">
            <L htmlFor={id("details")} optional>
              Details (one per line: fabric, fit, care)
            </L>
            <textarea id={id("details")} rows={3} value={details} onChange={(ev) => setDetails(ev.target.value)} className={cn(inputClasses(Boolean(e.details)), "mt-1.5 h-auto py-3")} />
            <Err id={id("details-err")} msg={e.details} />
          </div>
        </div>
      </section>

      <section className={box} aria-labelledby={id("pricing")}>
        <h2 id={id("pricing")} className="font-display text-xl">
          Price & visibility
        </h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <L htmlFor={id("price")}>Price (Rs)</L>
            <input id={id("price")} inputMode="decimal" value={basePrice} onChange={(ev) => setBasePrice(ev.target.value)} aria-invalid={Boolean(e.basePrice)} aria-describedby={e.basePrice ? id("price-err") : undefined} className={cn(inputClasses(Boolean(e.basePrice)), "mt-1.5")} />
            <Err id={id("price-err")} msg={e.basePrice} />
          </div>
          <div>
            <L htmlFor={id("compare")} optional>
              Was price (Rs) — shows a Sale badge
            </L>
            <input id={id("compare")} inputMode="decimal" value={compareAt} onChange={(ev) => setCompareAt(ev.target.value)} aria-invalid={Boolean(e.compareAtPrice)} aria-describedby={e.compareAtPrice ? id("compare-err") : undefined} className={cn(inputClasses(Boolean(e.compareAtPrice)), "mt-1.5")} />
            <Err id={id("compare-err")} msg={e.compareAtPrice} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={(ev) => setIsActive(ev.target.checked)} className="size-4 accent-ink" /> Show in shop
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isFeatured} onChange={(ev) => setIsFeatured(ev.target.checked)} className="size-4 accent-ink" /> Featured on homepage
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isNew} onChange={(ev) => setIsNew(ev.target.checked)} className="size-4 accent-ink" /> New arrival
          </label>
        </div>
      </section>

      <section className={box} aria-labelledby={id("variants")}>
        <h2 id={id("variants")} className="font-display text-xl">
          Sizes, colours & stock
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          One row per size + colour. Stock for existing rows is changed in <strong>Inventory</strong> (every change is recorded). Rows can be switched off but never deleted, so past orders stay linked.
        </p>
        {e.variants ? (
          <p className="mt-3 text-sm text-sale" role="alert">
            {e.variants}
          </p>
        ) : null}
        <ul className="mt-4 space-y-3" data-testid="variant-rows">
          {variants.map((v, i) => {
            const ve = (f: string) => e[`variants.${i}.${f}`];
            return (
              <li key={v.key} className={cn("grid gap-3 rounded-card border border-stone p-4 sm:grid-cols-6", !v.isActive && "opacity-60")} data-testid="variant-row">
                <div>
                  <L htmlFor={id(`size-${v.key}`)}>Size</L>
                  <input id={id(`size-${v.key}`)} value={v.size} onChange={(ev) => setVariant(v.key, { size: ev.target.value })} placeholder="M / 32 / One Size" aria-invalid={Boolean(ve("size"))} className={cn(inputClasses(Boolean(ve("size"))), "mt-1.5")} />
                  <Err id={id(`size-err-${v.key}`)} msg={ve("size")} />
                </div>
                <div className="sm:col-span-2">
                  <L htmlFor={id(`color-${v.key}`)}>Colour</L>
                  <div className="mt-1.5 flex gap-2">
                    <input id={id(`color-${v.key}`)} value={v.color} onChange={(ev) => setVariant(v.key, { color: ev.target.value })} placeholder="Navy" aria-invalid={Boolean(ve("color"))} className={inputClasses(Boolean(ve("color")))} />
                    <input type="color" value={v.colorHex} onChange={(ev) => setVariant(v.key, { colorHex: ev.target.value.toUpperCase() })} aria-label={`Swatch colour for ${v.color || "this row"}`} className="h-12 w-12 shrink-0 cursor-pointer rounded-xs border border-stone-strong bg-surface p-1" />
                  </div>
                  <Err id={id(`color-err-${v.key}`)} msg={ve("color") ?? ve("colorHex")} />
                </div>
                <div className="sm:col-span-2">
                  <L htmlFor={id(`sku-${v.key}`)}>SKU</L>
                  <input id={id(`sku-${v.key}`)} value={v.sku} onChange={(ev) => setVariant(v.key, { sku: ev.target.value.toUpperCase() })} placeholder={suggestSku(v) || "Auto"} aria-invalid={Boolean(ve("sku"))} className={cn(inputClasses(Boolean(ve("sku"))), "mt-1.5 font-mono")} />
                  <Err id={id(`sku-err-${v.key}`)} msg={ve("sku")} />
                </div>
                <div>
                  {v.id ? (
                    <>
                      <p className="text-sm font-medium">Stock</p>
                      <p className="mt-1.5 flex h-12 items-center font-semibold tabular-nums">{v.currentStock}</p>
                    </>
                  ) : (
                    <>
                      <L htmlFor={id(`stock-${v.key}`)}>Opening stock</L>
                      <input id={id(`stock-${v.key}`)} inputMode="numeric" value={v.stock} onChange={(ev) => setVariant(v.key, { stock: ev.target.value })} aria-invalid={Boolean(ve("stock"))} className={cn(inputClasses(Boolean(ve("stock"))), "mt-1.5")} />
                      <Err id={id(`stock-err-${v.key}`)} msg={ve("stock")} />
                    </>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <L htmlFor={id(`po-${v.key}`)} optional>
                    Different price (Rs)
                  </L>
                  <input id={id(`po-${v.key}`)} inputMode="decimal" value={v.priceOverride} onChange={(ev) => setVariant(v.key, { priceOverride: ev.target.value })} aria-invalid={Boolean(ve("priceOverride"))} className={cn(inputClasses(Boolean(ve("priceOverride"))), "mt-1.5")} />
                  <Err id={id(`po-err-${v.key}`)} msg={ve("priceOverride")} />
                </div>
                <div className="flex items-end gap-4 sm:col-span-4">
                  {v.id ? (
                    <label className="flex h-12 items-center gap-2 text-sm">
                      <input type="checkbox" checked={v.isActive} onChange={(ev) => setVariant(v.key, { isActive: ev.target.checked })} className="size-4 accent-ink" />
                      On sale in the shop
                    </label>
                  ) : (
                    <Button variant="ghost" onClick={() => setVariants((vs) => vs.filter((x) => x.key !== v.key))} disabled={variants.length === 1} aria-label={`Remove row ${i + 1}`}>
                      Remove row
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() =>
            setVariants((vs) => [
              ...vs,
              { key: newKey(), id: null, size: "", color: vs.at(-1)?.color ?? "", colorHex: vs.at(-1)?.colorHex ?? "#1F2937", sku: "", priceOverride: "", stock: "0", currentStock: null, isActive: true },
            ])
          }
        >
          Add size / colour
        </Button>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-stone bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border">
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Saving…" : product ? "Save product" : "Create product"}
        </Button>
      </div>
    </form>
  );
}
