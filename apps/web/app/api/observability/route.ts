import {
  reconstructOperationalErrorReport,
  type OperationalErrorReport,
} from "@egeria-systems/observability";

import {
  isProhibitedObservabilityToken,
  reportBrowserErrorReport,
  reportBrowserEvent,
  type BrowserOperationalInput,
} from "../../../src/infrastructure/observability/server-reporter";

const maximumPayloadBytes = 8_192;
const contextTokenPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const webVitalNames = ["CLS", "FCP", "FID", "INP", "LCP", "TTFB"] as const;
const webVitalRatings = ["good", "needs-improvement", "poor"] as const;
const navigationTypes = [
  "navigate",
  "reload",
  "back-forward",
  "back-forward-cache",
  "prerender",
  "restore",
] as const;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: object,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function includes<const Value extends string>(
  values: readonly Value[],
  value: unknown,
): value is Value {
  return typeof value === "string" && values.includes(value as Value);
}

function readEventId(value: unknown): string | undefined {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["eventId", "service"]) ||
    typeof value.eventId !== "string" ||
    !contextTokenPattern.test(value.eventId) ||
    isProhibitedObservabilityToken(value.eventId) ||
    value.service !== "web"
  ) {
    return undefined;
  }
  return value.eventId;
}

function isBrowserErrorReport(report: OperationalErrorReport): boolean {
  const { capture, event } = report;
  if (
    event.kind !== "application.error" ||
    event.runtime !== "browser" ||
    event.severity !== "error" ||
    readEventId(event.context) === undefined ||
    !hasExactKeys(event.attributes, [
      "capture_mechanism",
      "handled",
      ...(capture.operation === undefined ? [] : ["operation"]),
    ]) ||
    event.attributes.capture_mechanism !== capture.mechanism ||
    event.attributes.handled !== capture.handled ||
    (capture.operation === undefined
      ? "operation" in event.attributes
      : event.attributes.operation !== capture.operation)
  ) {
    return false;
  }

  switch (event.name) {
    case "browser.window.error":
      return (
        hasExactKeys(capture, ["handled", "mechanism"]) &&
        capture.mechanism === "browser-error-event" &&
        capture.handled === false
      );
    case "browser.unhandled.rejection":
      return (
        hasExactKeys(capture, ["handled", "mechanism"]) &&
        capture.mechanism === "browser-unhandled-rejection" &&
        capture.handled === false
      );
    case "browser.react.boundary":
      return (
        hasExactKeys(capture, ["handled", "mechanism"]) &&
        capture.mechanism === "react-error-boundary" &&
        capture.handled === true
      );
    case "browser.caught.error":
      return (
        hasExactKeys(capture, ["handled", "mechanism", "operation"]) &&
        capture.mechanism === "selected-catch" &&
        capture.handled === true
      );
    default:
      return false;
  }
}

function readWebVitalEvent(
  event: Readonly<Record<string, unknown>>,
): BrowserOperationalInput | undefined {
  if (
    !hasExactKeys(event, [
      "attributes",
      "context",
      "kind",
      "name",
      "occurredAt",
      "runtime",
      "schemaVersion",
      "severity",
    ]) ||
    event.schemaVersion !== "2.0.0" ||
    typeof event.occurredAt !== "string" ||
    Number.isNaN(Date.parse(event.occurredAt)) ||
    event.name !== "browser.web.vital" ||
    event.kind !== "web.vital" ||
    event.runtime !== "browser" ||
    event.severity !== "info" ||
    !isRecord(event.attributes) ||
    !hasExactKeys(event.attributes, [
      "delta",
      "metric_name",
      "navigation_type",
      "rating",
      "value",
    ]) ||
    !includes(webVitalNames, event.attributes.metric_name) ||
    typeof event.attributes.value !== "number" ||
    !Number.isFinite(event.attributes.value) ||
    Math.abs(event.attributes.value) > 1_000_000_000 ||
    typeof event.attributes.delta !== "number" ||
    !Number.isFinite(event.attributes.delta) ||
    Math.abs(event.attributes.delta) > 1_000_000_000 ||
    !includes(webVitalRatings, event.attributes.rating) ||
    !includes(navigationTypes, event.attributes.navigation_type)
  ) {
    return undefined;
  }
  const eventId = readEventId(event.context);
  if (eventId === undefined) return undefined;
  return Object.freeze({
    name: "browser.web.vital",
    kind: "web.vital",
    severity: "info",
    eventId,
    attributes: Object.freeze({
      metric_name: event.attributes.metric_name,
      value: event.attributes.value,
      delta: event.attributes.delta,
      rating: event.attributes.rating,
      navigation_type: event.attributes.navigation_type,
    }),
    allowedAttributeNames: Object.freeze([
      "delta",
      "metric_name",
      "navigation_type",
      "rating",
      "value",
    ]),
  });
}

type BrowserInput =
  | Readonly<{ kind: "error-report"; report: OperationalErrorReport }>
  | Readonly<{ event: BrowserOperationalInput; kind: "event" }>;

function readBrowserInput(value: unknown): BrowserInput | undefined {
  if (
    !isRecord(value) ||
    value.schemaVersion !== "2.0.0" ||
    (value.type !== "error-report" && value.type !== "operational-event")
  ) {
    return undefined;
  }

  if (value.type === "error-report") {
    if (!hasExactKeys(value, ["report", "schemaVersion", "type"])) {
      return undefined;
    }
    const reconstructed = reconstructOperationalErrorReport(value.report);
    return reconstructed.ok && isBrowserErrorReport(reconstructed.value)
      ? Object.freeze({ kind: "error-report", report: reconstructed.value })
      : undefined;
  }

  if (
    !hasExactKeys(value, ["event", "schemaVersion", "type"]) ||
    !isRecord(value.event)
  ) {
    return undefined;
  }
  const event = readWebVitalEvent(value.event);
  return event === undefined
    ? undefined
    : Object.freeze({ kind: "event", event });
}

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return false;

  let originURL: URL;
  try {
    originURL = new URL(origin);
  } catch {
    return false;
  }
  if (
    (originURL.protocol !== "http:" && originURL.protocol !== "https:") ||
    origin !== originURL.origin
  ) {
    return false;
  }

  const requestURL = new URL(request.url);
  if (originURL.origin === requestURL.origin) return true;

  const host = request.headers.get("host");
  return (
    host !== null &&
    request.headers.get("sec-fetch-site") === "same-origin" &&
    originURL.protocol === requestURL.protocol &&
    originURL.host === host.toLowerCase()
  );
}

type BoundedBodyResult =
  | { readonly ok: true; readonly source: string }
  | { readonly ok: false; readonly reason: "invalid" | "too-large" };

async function readBoundedBody(request: Request): Promise<BoundedBodyResult> {
  if (request.body === null) return { ok: true, source: "" };

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let source = "";
  let totalBytes = 0;

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;

      totalBytes += chunk.value.byteLength;
      if (totalBytes > maximumPayloadBytes) {
        try {
          await reader.cancel();
        } catch {
          // The bounded rejection is unchanged when cancellation fails.
        }
        return { ok: false, reason: "too-large" };
      }
      source += decoder.decode(chunk.value, { stream: true });
    }

    source += decoder.decode();
    return { ok: true, source };
  } catch {
    try {
      await reader.cancel();
    } catch {
      // The invalid-body response is unchanged when cancellation fails.
    }
    return { ok: false, reason: "invalid" };
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!hasSameOrigin(request)) {
    return emptyResponse(403);
  }
  if (
    request.headers.get("content-type")?.split(";", 1)[0] !==
    "application/json"
  ) {
    return emptyResponse(415);
  }

  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength !== null &&
    (!/^\d+$/u.test(declaredLength) ||
      Number(declaredLength) > maximumPayloadBytes)
  ) {
    return emptyResponse(413);
  }

  const body = await readBoundedBody(request);
  if (!body.ok) {
    return emptyResponse(body.reason === "too-large" ? 413 : 400);
  }

  let input: BrowserInput | undefined;
  try {
    input = readBrowserInput(JSON.parse(body.source) as unknown);
  } catch {
    return emptyResponse(400);
  }
  if (input === undefined) return emptyResponse(400);

  try {
    if (input.kind === "error-report") {
      await reportBrowserErrorReport(input.report);
    } else {
      await reportBrowserEvent(input.event);
    }
  } catch {
    // A reporting failure cannot change the application response.
  }
  return emptyResponse(202);
}
