"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-page py-16">
      <ErrorState
        title="We couldn't load this page"
        description="Our store had trouble reaching its catalogue. Please try again — your cart is safe."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={reset}>Try again</Button>
            <ButtonLink href="/" variant="secondary">
              Go to homepage
            </ButtonLink>
          </div>
        }
      />
      {error.digest ? <p className="mt-4 text-center text-xs text-muted">Reference: {error.digest}</p> : null}
    </div>
  );
}
