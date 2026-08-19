import { reportBrowserError } from "./src/infrastructure/observability/browser-reporter";

globalThis.addEventListener("error", (event: ErrorEvent) => {
  reportBrowserError(event.error ?? event.message, "window-error");
});

globalThis.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
  reportBrowserError(event.reason, "unhandled-rejection");
});
