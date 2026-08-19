"use client";

import { useEffect } from "react";

import { readErrorFallbackCopy } from "../src/infrastructure/observability/error-copy";
import { reportReactBoundaryError } from "../src/infrastructure/observability/browser-reporter";
import { ErrorFallback } from "../src/presentation/error-fallback";

type ErrorBoundaryProps = Readonly<{
  error: Error;
  reset: () => void;
}>;

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    reportReactBoundaryError(error, { boundary: "page" });
  }, [error]);

  return <ErrorFallback copy={readErrorFallbackCopy()} onRetry={reset} />;
}
