import { storeConfig } from "@/config/store";

/** Temporary Phase 1 landing page — replaced by the real homepage in Phase 2. */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-3xl font-semibold">{storeConfig.name}</h1>
      <p>{storeConfig.tagline}</p>
      <p className="text-sm opacity-70">The store is being set up. Please check back soon.</p>
    </main>
  );
}
