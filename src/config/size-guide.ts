/**
 * Size charts (inches). Placeholder measurements — replace with the store's
 * real pattern measurements before launch. Shown in the product page size
 * guide dialog and on /size-guide.
 */
export interface SizeChart {
  id: "tops" | "bottoms" | "belts";
  title: string;
  note: string;
  columns: string[];
  rows: string[][];
}

export const SIZE_CHARTS: Record<SizeChart["id"], SizeChart> = {
  tops: {
    id: "tops",
    title: "Jackets & shirts",
    note: "Measure around the fullest part of the chest, under the arms. Between sizes? Size up for layering.",
    columns: ["Size", "Chest", "Length", "Shoulder", "Sleeve"],
    rows: [
      ["S", "38", "27", "17", "24.5"],
      ["M", "40", "28", "17.75", "25"],
      ["L", "42", "29", "18.5", "25.5"],
      ["XL", "44", "30", "19.25", "26"],
    ],
  },
  bottoms: {
    id: "bottoms",
    title: "Jeans & trousers",
    note: "Measure your natural waist where trousers usually sit. Inseam is from the crotch seam to the hem.",
    columns: ["Size", "Waist", "Hip", "Inseam"],
    rows: [
      ["26", "26", "35", "30"],
      ["28", "28", "37", "30"],
      ["30", "30", "39", "31"],
      ["32", "32", "41", "31"],
      ["34", "34", "43", "32"],
      ["36", "36", "45", "32"],
    ],
  },
  belts: {
    id: "belts",
    title: "Belts",
    note: "Choose your trouser waist size. The belt fits that waist on the middle hole.",
    columns: ["Size", "Fits waist", "Total length"],
    rows: [
      ["32", "30–32", "40"],
      ["34", "32–34", "42"],
      ["36", "34–36", "44"],
      ["38", "36–38", "46"],
    ],
  },
};

const BY_CATEGORY: Record<string, SizeChart["id"]> = {
  jackets: "tops",
  shirts: "tops",
  jeans: "bottoms",
  trousers: "bottoms",
};

/** Which chart applies to a product (null for one-size items). */
export function sizeChartFor(categorySlug: string | null | undefined, sizes: string[]): SizeChart | null {
  if (sizes.length <= 1) return null;
  const id = categorySlug ? BY_CATEGORY[categorySlug] : undefined;
  if (id) return SIZE_CHARTS[id];
  if (sizes.every((s) => /^\d+$/.test(s)) && sizes.some((s) => Number(s) >= 32) && categorySlug === "accessories") {
    return SIZE_CHARTS.belts;
  }
  return null;
}
