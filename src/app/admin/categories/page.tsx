/**
 * /admin/categories — category management (PDF §5): create, edit,
 * organise (sort order) and control visibility. Live via API, demo
 * via the local admin catalogue.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { adminGet, adminSend } from "@/lib/admin-client";
import { getAdminCategories, saveAdminCategories } from "@/lib/admin-data";
import type { AdminCategory } from "@/lib/admin-types";
import {
  EmptyState,
  LoadingState,
  PageTitle,
} from "@/components/admin-ui";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<AdminCategory[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSort, setEditSort] = useState(99);
  const [editActive, setEditActive] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    adminGet("/api/admin/categories")
      .then((json) => {
        if (json.mode === "live" && Array.isArray(json.categories)) {
          setCategories(json.categories as AdminCategory[]);
        } else {
          setCategories(getAdminCategories());
        }
      })
      .catch(() => setCategories(getAdminCategories()));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const json = await adminSend("/api/admin/categories", "POST", {
        name: name.trim(),
        description: description.trim(),
        sortOrder: (categories?.length ?? 0) + 1,
        isActive: true,
      });
      if (json.mode === "demo") {
        const next: AdminCategory = {
          id: `demo-cat-${Date.now()}`,
          name: name.trim(),
          slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          description: description.trim(),
          image: "",
          sortOrder: (categories?.length ?? 0) + 1,
          isActive: true,
          productCount: 0,
          demo: true,
        };
        saveAdminCategories([...(categories ?? []), next]);
      }
      setName("");
      setDescription("");
      setMessage("Category added.");
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not add the category.");
    }
  }

  function startEdit(c: AdminCategory) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditDescription(c.description);
    setEditSort(c.sortOrder);
    setEditActive(c.isActive);
  }

  async function saveEdit(c: AdminCategory) {
    try {
      const json = await adminSend(`/api/admin/categories/${c.id}`, "PATCH", {
        name: editName.trim(),
        slug: c.slug,
        description: editDescription.trim(),
        image: c.image,
        sortOrder: editSort,
        isActive: editActive,
      });
      if (json.mode === "demo") {
        saveAdminCategories(
          (categories ?? []).map((x) =>
            x.id === c.id
              ? { ...x, name: editName.trim(), description: editDescription.trim(), sortOrder: editSort, isActive: editActive }
              : x,
          ),
        );
      }
      setEditingId(null);
      setMessage("Category updated.");
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update the category.");
    }
  }

  async function remove(c: AdminCategory) {
    if (!window.confirm(`Delete the "${c.name}" category? Products in it lose their category.`)) return;
    try {
      const json = await adminSend(`/api/admin/categories/${c.id}`, "DELETE");
      if (json.mode === "demo") {
        saveAdminCategories((categories ?? []).filter((x) => x.id !== c.id));
      }
      setMessage(`Category "${c.name}" deleted.`);
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not delete the category.");
    }
  }

  if (!categories) return <LoadingState label="Loading categories…" />;

  return (
    <div>
      <PageTitle title="Categories" subtitle={`${categories.length} categories`} />

      {message && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </p>
      )}

      <form onSubmit={(e) => void create(e)} className="mb-4 flex flex-col gap-2 rounded-lg border bg-white p-4 shadow-sm sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name *"
          required
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-[#0f2440] px-4 py-2 text-sm font-medium text-white">
          Add category
        </button>
      </form>

      {categories.length === 0 ? (
        <EmptyState message="No categories yet." />
      ) : (
        <div className="space-y-2">
          {categories.map((c) => (
            <article key={c.id} className="rounded-lg border bg-white p-4 shadow-sm">
              {editingId === c.id ? (
                <div className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded border px-3 py-2 text-sm" aria-label="Category name" />
                    <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description" className="rounded border px-3 py-2 text-sm" aria-label="Category description" />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <label className="flex items-center gap-2">
                      Sort order
                      <input value={editSort} onChange={(e) => setEditSort(Number(e.target.value) || 0)} type="number" className="w-20 rounded border px-2 py-1.5" />
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                      Visible on storefront
                    </label>
                    <button type="button" onClick={() => void saveEdit(c)} className="rounded bg-[#0f2440] px-4 py-2 text-sm font-medium text-white">Save</button>
                    <button type="button" onClick={() => setEditingId(null)} className="rounded border px-4 py-2 text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold">{c.name}</span>
                    <span className="ml-2 text-sm text-zinc-500">/{c.slug} · order {c.sortOrder} · {c.productCount} product(s)</span>
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${c.isActive ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-700"}`}>
                      {c.isActive ? "Visible" : "Hidden"}
                    </span>
                    {c.description && <p className="text-sm text-zinc-500">{c.description}</p>}
                  </div>
                  <div className="flex gap-3 text-sm">
                    <button type="button" onClick={() => startEdit(c)} className="text-sky-700 underline">Edit</button>
                    <button type="button" onClick={() => void remove(c)} className="text-red-600 underline">Delete</button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
