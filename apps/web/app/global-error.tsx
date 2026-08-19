"use client";

import { useEffect } from "react";

import { readErrorFallbackCopy } from "../src/infrastructure/observability/error-copy";
import { reportReactBoundaryError } from "../src/infrastructure/observability/browser-reporter";
import { ErrorFallback } from "../src/presentation/error-fallback";

type GlobalErrorBoundaryProps = Readonly<{
  error: Error;
  reset: () => void;
}>;

export default function GlobalErrorBoundary({
  error,
  reset,
}: GlobalErrorBoundaryProps) {
  useEffect(() => {
    reportReactBoundaryError(error, { boundary: "global" });
  }, [error]);

  return (
    <html lang="en-CA">
      <body>
        <ErrorFallback copy={readErrorFallbackCopy()} onRetry={reset} />
      </body>
    </html>
  );
}
