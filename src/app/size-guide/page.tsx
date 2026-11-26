import type { Metadata } from "next";
import { SIZE_CHARTS } from "@/config/size-guide";
import { Breadcrumbs } from "@/components/listing/ListingPage";
import { SizeChartTable } from "@/components/product/SizeGuide";

export const metadata: Metadata = {
  title: "Size guide",
  description: "Size charts for jackets, shirts, jeans, trousers and belts.",
};

export default function SizeGuidePage() {
  return (
    <div className="container-page py-8 sm:py-10">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Size guide" }]} />
      <h1 className="mt-6 font-display text-4xl font-medium tracking-tight sm:text-5xl">Size guide</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        All measurements are body measurements in inches. Not sure? Message us on WhatsApp with your height and usual size.
      </p>
      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        {Object.values(SIZE_CHARTS).map((chart) => (
          <section key={chart.id} className="rounded-card border border-stone bg-surface p-6">
            <SizeChartTable chart={chart} />
          </section>
        ))}
      </div>
    </div>
  );
}
