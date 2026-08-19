import type { ErrorFallbackCopy } from "../infrastructure/observability/error-copy";

type ErrorFallbackProps = Readonly<{
  copy: ErrorFallbackCopy;
  onRetry: () => void;
}>;

export function ErrorFallback({ copy, onRetry }: ErrorFallbackProps) {
  return (
    <main
      aria-labelledby="error-fallback-heading"
      className="mx-auto flex min-h-screen max-w-3xl items-center py-16 pe-6 ps-6"
    >
      <section className="space-y-6">
        <h1
          className="text-4xl font-semibold tracking-tight"
          id="error-fallback-heading"
        >
          {copy.heading}
        </h1>
        <p className="text-lg text-muted">{copy.summary}</p>
        <button
          className="min-h-11 min-w-11 rounded-md bg-accent py-2 pe-4 ps-4 font-semibold text-accent-contrast hover:bg-accent-hover"
          onClick={onRetry}
          type="button"
        >
          {copy.retryLabel}
        </button>
      </section>
    </main>
  );
}
