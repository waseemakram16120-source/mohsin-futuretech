import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { TrackForm } from "@/components/orders/TrackForm";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Check the status of your order with your order number and mobile number.",
};

type Props = { searchParams: Promise<{ order?: string }> };

export default async function TrackPage({ searchParams }: Props) {
  const { order } = await searchParams;
  return (
    <AuthShell
      title="Track your order"
      intro="Enter your order number and the mobile number you used at checkout."
      footer={
        <>
          Have an account?{" "}
          <Link href="/login?next=/account/orders" className="font-medium text-ink underline underline-offset-4">
            Sign in to see all your orders
          </Link>
        </>
      }
    >
      <TrackForm defaultOrderNumber={typeof order === "string" ? order.slice(0, 20) : ""} />
    </AuthShell>
  );
}
