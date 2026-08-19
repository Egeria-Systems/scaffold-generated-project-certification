import {
  createOperationalErrorReport,
  createOperationalEvent,
  dispatchOperationalErrorReport,
  dispatchOperationalEvent,
  normalizeErrorCategory,
  type ErrorCaptureContext,
} from "@egeria-systems/observability";
import {
  createBrowserDiagnosticSink,
  createBrowserSink,
  type BrowserEnvelope,
  type BrowserErrorEnvelope,
} from "@egeria-systems/observability/browser";

type WebVitalInput = Readonly<{
  name: string;
  value: number;
  delta: number;
  rating: string;
  navigationType: string;
}>;

type BrowserErrorSource = "unhandled-rejection" | "window-error";

type CaughtBrowserErrorContext = Readonly<{
  operation: string;
}>;

type ReactBoundaryErrorContext = Readonly<{
  boundary: "global" | "page";
}>;

const reportedErrorObjects = new WeakSet<object>();
const errorAttributeNames = Object.freeze([
  "capture_mechanism",
  "handled",
  "operation",
]);

function createEventContext() {
  return Object.freeze({ eventId: crypto.randomUUID(), service: "web" });
}

function sendEnvelope(envelope: BrowserEnvelope | BrowserErrorEnvelope) {
  return fetch("/api/observability", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    referrerPolicy: "no-referrer",
    keepalive: true,
    body: JSON.stringify(envelope),
  }).then(({ ok }) => ok);
}

function createSameOriginSink() {
  return createBrowserSink({
    identifier: "same-origin-route",
    send: sendEnvelope,
  });
}

function createSameOriginDiagnosticSink() {
  return createBrowserDiagnosticSink({
    identifier: "same-origin-route",
    send: sendEnvelope,
  });
}

function reportBrowserInput(
  input: Parameters<typeof createOperationalEvent>[0],
  allowedAttributeNames: readonly string[],
): void {
  const event = createOperationalEvent(input, {
    allowedAttributeNames,
    clock: { now: () => new Date() },
  });
  if (!event.ok) return;
  void dispatchOperationalEvent(event.value, [createSameOriginSink()]);
}

export function reportBrowserError(
  error: unknown,
  source: BrowserErrorSource,
): void {
  reportBrowserErrorWithCapture(
    error,
    source === "window-error"
      ? "browser.window.error"
      : "browser.unhandled.rejection",
    Object.freeze({
      mechanism:
        source === "window-error"
          ? "browser-error-event"
          : "browser-unhandled-rejection",
      handled: false,
    }),
  );
}

function isWeakSetValue(value: unknown): value is object {
  return (
    (typeof value === "object" && value !== null) ||
    typeof value === "function"
  );
}

function reportBrowserErrorWithCapture(
  error: unknown,
  name:
    | "browser.caught.error"
    | "browser.react.boundary"
    | "browser.unhandled.rejection"
    | "browser.window.error",
  capture: ErrorCaptureContext,
): void {
  if (isWeakSetValue(error) && reportedErrorObjects.has(error)) return;

  const event = createOperationalEvent(
    {
      name,
      kind: "application.error",
      runtime: "browser",
      severity: "error",
      context: createEventContext(),
      errorCategory: normalizeErrorCategory(error),
      attributes: {
        capture_mechanism: capture.mechanism,
        handled: capture.handled,
        ...(capture.operation === undefined
          ? {}
          : { operation: capture.operation }),
      },
    },
    {
      allowedAttributeNames: errorAttributeNames,
      clock: { now: () => new Date() },
    },
  );
  if (!event.ok) return;

  const report = createOperationalErrorReport(event.value, error, capture, {});
  if (!report.ok) return;

  if (isWeakSetValue(error)) reportedErrorObjects.add(error);
  void dispatchOperationalErrorReport(report.value, {
    operationalSinks: [],
    diagnosticSinks: [createSameOriginDiagnosticSink()],
  });
}

export function reportCaughtBrowserError(
  error: unknown,
  context: CaughtBrowserErrorContext,
): void {
  reportBrowserErrorWithCapture(
    error,
    "browser.caught.error",
    Object.freeze({
      mechanism: "selected-catch",
      handled: true,
      operation: context.operation,
    }),
  );
}

export function reportReactBoundaryError(
  error: unknown,
  context: ReactBoundaryErrorContext,
): void {
  if (context.boundary !== "global" && context.boundary !== "page") return;
  reportBrowserErrorWithCapture(
    error,
    "browser.react.boundary",
    Object.freeze({
      mechanism: "react-error-boundary",
      handled: true,
    }),
  );
}

export function reportWebVital(metric: WebVitalInput): void {
  reportBrowserInput(
    {
      name: "browser.web.vital",
      kind: "web.vital",
      runtime: "browser",
      severity: "info",
      context: createEventContext(),
      attributes: {
        metric_name: metric.name,
        value: metric.value,
        delta: metric.delta,
        rating: metric.rating,
        navigation_type: metric.navigationType,
      },
    },
    ["delta", "metric_name", "navigation_type", "rating", "value"],
  );
}
