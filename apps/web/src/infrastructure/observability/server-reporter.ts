import {
  createOperationalErrorReport,
  createOperationalEvent,
  dispatchOperationalErrorReport,
  dispatchOperationalEvent,
  normalizeErrorCategory,
  type DispatchResult,
  type ErrorCaptureContext,
  type OperationalAttributeValue,
  type OperationalErrorReport,
  type OperationalEventInput,
  type OperationalSink,
} from "@egeria-systems/observability";
import {
  createBetterStackDiagnosticSink,
  createBetterStackSink,
  createStructuredLogSink,
} from "@egeria-systems/observability/server";

import {
  readObservabilityRuntimeContext,
  type ObservabilityRuntimeContext,
} from "../cloudflare/observability-context";

export type BrowserOperationalInput = Readonly<{
  name: "browser.web.vital";
  kind: "web.vital";
  severity: "info";
  eventId: string;
  attributes: Readonly<Record<string, OperationalAttributeValue>>;
  allowedAttributeNames: readonly string[];
}>;

export type ServerRequestErrorContext = Readonly<{
  correlationId?: unknown;
  requestMethod?: unknown;
  routerKind?: unknown;
  routePath?: unknown;
  routeType?: unknown;
  renderSource?: unknown;
  renderType?: unknown;
  revalidateReason?: unknown;
}>;

export type CaughtServerErrorContext = Readonly<{
  operation: string;
  correlationId?: string;
}>;

const contextTokenPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const operationPattern = /^[a-z][a-z0-9.-]{0,63}$/u;
const prohibitedObservabilityTokenPattern =
  /(?:authorization|bearer|cookie|credential|password|secret|token)/iu;
const requestMethods = Object.freeze([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const);
const routeTypes = Object.freeze(["action", "proxy", "render", "route"] as const);
const renderSources = Object.freeze([
  "react-server-components",
  "react-server-components-payload",
  "server-rendering",
] as const);
const renderTypes = Object.freeze(["dynamic", "dynamic-resume"] as const);
const revalidateReasons = Object.freeze(["on-demand", "stale"] as const);
const serverAttributeNames = Object.freeze([
  "capture_mechanism",
  "handled",
  "operation",
  "render_source",
  "render_type",
  "http_method",
  "revalidate_reason",
  "route_identifier",
  "route_type",
  "router_kind",
]);
const deliveryFailureAttributeNames = Object.freeze(["reason", "sink"]);

function includes<const Value extends string>(
  values: readonly Value[],
  value: unknown,
): value is Value {
  return typeof value === "string" && values.includes(value as Value);
}

function readField(value: unknown, key: string): unknown {
  try {
    return typeof value === "object" && value !== null
      ? Reflect.get(value, key)
      : undefined;
  } catch {
    return undefined;
  }
}

function readContextToken(value: unknown): string | undefined {
  return typeof value === "string" &&
    contextTokenPattern.test(value) &&
    !isProhibitedObservabilityToken(value)
    ? value
    : undefined;
}

function readOperation(value: unknown): string | undefined {
  return typeof value === "string" &&
    operationPattern.test(value) &&
    !isProhibitedObservabilityToken(value)
    ? value
    : undefined;
}

function normalizeRouterKind(
  value: unknown,
): ErrorCaptureContext["routerKind"] | undefined {
  if (value === "App Router") return "app-router";
  if (value === "Pages Router") return "pages-router";
  return undefined;
}

function normalizeRouteSegment(segment: string): string | undefined {
  if (/^\([A-Za-z0-9][A-Za-z0-9_-]{0,63}\)$/u.test(segment)) {
    return "group";
  }
  if (/^\[\[\.\.\.[A-Za-z][A-Za-z0-9_-]{0,63}\]\]$/u.test(segment)) {
    return "[optional-catch-all]";
  }
  if (/^\[\.\.\.[A-Za-z][A-Za-z0-9_-]{0,63}\]$/u.test(segment)) {
    return "[catch-all]";
  }
  if (/^\[[A-Za-z][A-Za-z0-9_-]{0,63}\]$/u.test(segment)) {
    return "[dynamic]";
  }
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u.test(segment) &&
    !isProhibitedObservabilityToken(segment)
    ? segment
    : undefined;
}

function normalizeRouteIdentifier(
  value: unknown,
  routerKind: ErrorCaptureContext["routerKind"] | undefined,
  routeType: ErrorCaptureContext["routeType"] | undefined,
): string | undefined {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 1_024 ||
    value.includes("\\") ||
    value.includes("?") ||
    value.includes("#")
  ) {
    return undefined;
  }
  if (routeType === "proxy") {
    return routerKind === "pages-router" && value === "/proxy"
      ? "proxy"
      : undefined;
  }
  if (routerKind === "pages-router" && value === "/") return "root";

  const segments = value.split("/");
  if (segments[0] !== "") return undefined;
  const routeSegments =
    routerKind === "app-router" && segments[1] === "app"
      ? segments.slice(2)
      : routerKind === "pages-router"
        ? segments.slice(1)
        : [];
  if (
    routeSegments.length === 0 ||
    routeSegments.some((segment) => segment.length === 0)
  ) {
    return undefined;
  }
  const normalized = routeSegments.map(normalizeRouteSegment);
  if (normalized.some((segment) => segment === undefined)) return undefined;
  const identifier = normalized.join("/");
  return identifier.length <= 256 ? identifier : undefined;
}

function createOperationalRouteIdentifier(
  value: string | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  const identifier = value
    .split("/")
    .map((segment) => {
      if (segment === "[dynamic]") return "dynamic";
      if (segment === "[catch-all]") return "catch-all";
      if (segment === "[optional-catch-all]") return "optional-catch-all";
      return segment;
    })
    .join(".");
  return identifier.length <= 64 ? identifier : undefined;
}

export function isProhibitedObservabilityToken(value: string): boolean {
  return prohibitedObservabilityTokenPattern.test(value);
}

function createNextRequestCapture(
  context: unknown,
): ErrorCaptureContext {
  const routerKindValue = readField(context, "routerKind");
  const routeTypeValue = readField(context, "routeType");
  const renderSourceValue = readField(context, "renderSource");
  const renderTypeValue = readField(context, "renderType");
  const revalidateReasonValue = readField(context, "revalidateReason");
  const requestMethodValue = readField(context, "requestMethod");
  const routerKind = normalizeRouterKind(routerKindValue);
  const routeType = includes(routeTypes, routeTypeValue)
    ? routeTypeValue
    : undefined;
  const renderSource = includes(renderSources, renderSourceValue)
    ? renderSourceValue
    : undefined;
  const renderType = includes(renderTypes, renderTypeValue)
    ? renderTypeValue
    : undefined;
  const revalidateReason = includes(revalidateReasons, revalidateReasonValue)
    ? revalidateReasonValue
    : undefined;
  const requestMethod = includes(requestMethods, requestMethodValue)
    ? requestMethodValue
    : undefined;
  const routeIdentifier = normalizeRouteIdentifier(
    readField(context, "routePath"),
    routerKind,
    routeType,
  );

  return Object.freeze({
    mechanism: "next-request-error" as const,
    handled: false,
    ...(routerKind === undefined ? {} : { routerKind }),
    ...(routeType === undefined ? {} : { routeType }),
    ...(renderSource === undefined ? {} : { renderSource }),
    ...(renderType === undefined ? {} : { renderType }),
    ...(revalidateReason === undefined ? {} : { revalidateReason }),
    ...(requestMethod === undefined ? {} : { requestMethod }),
    ...(routeIdentifier === undefined ? {} : { routeIdentifier }),
  });
}

function createCaptureAttributes(
  capture: ErrorCaptureContext,
): Readonly<Record<string, OperationalAttributeValue>> {
  const routeIdentifier = createOperationalRouteIdentifier(
    capture.routeIdentifier,
  );
  return Object.freeze({
    capture_mechanism: capture.mechanism,
    handled: capture.handled,
    ...(capture.operation === undefined ? {} : { operation: capture.operation }),
    ...(capture.routerKind === undefined
      ? {}
      : { router_kind: capture.routerKind }),
    ...(capture.routeType === undefined ? {} : { route_type: capture.routeType }),
    ...(capture.renderSource === undefined
      ? {}
      : { render_source: capture.renderSource }),
    ...(capture.renderType === undefined
      ? {}
      : { render_type: capture.renderType }),
    ...(capture.revalidateReason === undefined
      ? {}
      : { revalidate_reason: capture.revalidateReason }),
    ...(capture.requestMethod === undefined
      ? {}
      : { http_method: capture.requestMethod }),
    ...(routeIdentifier === undefined
      ? {}
      : { route_identifier: routeIdentifier }),
  });
}

async function requestBetterStack(input: Readonly<{
  url: string;
  method: "POST";
  headers: Readonly<Record<string, string>>;
  body: string;
  timeoutMilliseconds: number;
}>): Promise<Readonly<{ status: number }>> {
  const response = await fetch(input.url, {
    method: input.method,
    headers: input.headers,
    body: input.body,
    signal: AbortSignal.timeout(input.timeoutMilliseconds),
  });
  return Object.freeze({ status: response.status });
}

function createStructuredSink(): OperationalSink {
  return createStructuredLogSink({
    identifier: "cloudflare-workers-logs",
    write: (record) => console.info(record),
  });
}

function createEventContext(
  runtime: ObservabilityRuntimeContext,
  correlationId: unknown,
): OperationalEventInput["context"] {
  const normalizedCorrelationId = readContextToken(correlationId);
  const releaseId = readContextToken(runtime.releaseId);
  return Object.freeze({
    eventId: crypto.randomUUID(),
    ...(normalizedCorrelationId === undefined
      ? {}
      : { correlationId: normalizedCorrelationId }),
    ...(releaseId === undefined ? {} : { releaseId }),
    service: "web",
  });
}

async function reportDeliveryFailure(
  runtime: ObservabilityRuntimeContext,
  structuredSink: OperationalSink,
  result: Extract<DispatchResult, { status: "failed" }>,
): Promise<void> {
  const event = createOperationalEvent(
    {
      name: "observability.delivery.failed",
      kind: "application.lifecycle",
      runtime: "server",
      severity: "warning",
      context: createEventContext(runtime, undefined),
      attributes: { reason: result.reason, sink: result.sink },
    },
    {
      allowedAttributeNames: deliveryFailureAttributeNames,
      clock: { now: () => new Date() },
    },
  );
  if (!event.ok) return;
  await dispatchOperationalEvent(event.value, [structuredSink]);
}

async function reportError(
  error: unknown,
  capture: ErrorCaptureContext,
  correlationId: unknown,
  name: "server.caught.error" | "server.request.error",
): Promise<void> {
  try {
    const runtime = await readObservabilityRuntimeContext();
    const event = createOperationalEvent(
      {
        name,
        kind: "application.error",
        runtime: "server",
        severity: "error",
        context: createEventContext(runtime, correlationId),
        errorCategory: normalizeErrorCategory(error),
        attributes: createCaptureAttributes(capture),
      },
      {
        allowedAttributeNames: serverAttributeNames,
        clock: { now: () => new Date() },
      },
    );
    if (!event.ok) return;

    const report = createOperationalErrorReport(event.value, error, capture, {});
    if (!report.ok) return;

    await dispatchErrorReport(runtime, report.value);
  } catch {
    // Error reporting must never become an application failure.
  }
}

async function dispatchErrorReport(
  runtime: ObservabilityRuntimeContext,
  report: OperationalErrorReport,
): Promise<void> {
  const structuredSink = createStructuredSink();
  const diagnosticSink = createBetterStackDiagnosticSink({
    ingestingHost: runtime.ingestingHost,
    sourceToken: runtime.sourceToken,
    request: requestBetterStack,
    timeoutMilliseconds: 5_000,
  });
  let deliveryFailureReported = false;
  const reportFailureOnce = async (
    result: Extract<DispatchResult, { status: "failed" }>,
  ): Promise<void> => {
    if (deliveryFailureReported) return;
    deliveryFailureReported = true;
    await reportDeliveryFailure(runtime, structuredSink, result);
  };
  const delivery = (async (): Promise<void> => {
    const results = await dispatchOperationalErrorReport(report, {
      operationalSinks: [structuredSink],
      diagnosticSinks: diagnosticSink.ok ? [diagnosticSink.value] : [],
    });
    const diagnosticFailure = results.find(
      (result): result is Extract<DispatchResult, { status: "failed" }> =>
        result.sink === "better-stack" && result.status === "failed",
    );
    if (diagnosticFailure !== undefined) {
      await reportFailureOnce(diagnosticFailure);
    }
  })().then(
    () => undefined,
    () => undefined,
  );

  try {
    runtime.schedule(delivery);
  } catch {
    await reportFailureOnce({
      sink: "cloudflare-execution-context",
      status: "failed",
      reason: "sink-threw",
    });
  }
}

async function reportOperationalInput(
  input: OperationalEventInput,
  allowedAttributeNames: readonly string[],
): Promise<void> {
  try {
    const runtime = await readObservabilityRuntimeContext();
    const eventContext = createEventContext(
      runtime,
      input.context.correlationId,
    );
    const event = createOperationalEvent(
      {
        ...input,
        context: {
          ...input.context,
          ...eventContext,
          eventId: input.context.eventId ?? eventContext.eventId,
        },
      },
      {
        allowedAttributeNames,
        clock: { now: () => new Date() },
      },
    );
    if (!event.ok) return;

    const sinks: OperationalSink[] = [createStructuredSink()];
    const betterStack = createBetterStackSink({
      ingestingHost: runtime.ingestingHost,
      sourceToken: runtime.sourceToken,
      request: requestBetterStack,
      timeoutMilliseconds: 5_000,
    });
    if (betterStack.ok) sinks.push(betterStack.value);

    const delivery = dispatchOperationalEvent(event.value, sinks).then(
      () => undefined,
      () => undefined,
    );
    runtime.schedule(delivery);
  } catch {
    // Operational reporting must never become an application failure.
  }
}

export async function reportServerError(
  error: unknown,
  context: ServerRequestErrorContext = {},
): Promise<void> {
  await reportError(
    error,
    createNextRequestCapture(context),
    readField(context, "correlationId"),
    "server.request.error",
  );
}

export async function reportCaughtServerError(
  error: unknown,
  context: CaughtServerErrorContext,
): Promise<void> {
  const operation = readOperation(readField(context, "operation"));
  if (operation === undefined) return;
  await reportError(
    error,
    Object.freeze({
      mechanism: "selected-catch",
      handled: true,
      operation,
    }),
    readField(context, "correlationId"),
    "server.caught.error",
  );
}

export async function reportBrowserEvent(
  input: BrowserOperationalInput,
): Promise<void> {
  await reportOperationalInput(
    {
      name: input.name,
      kind: input.kind,
      runtime: "browser",
      severity: input.severity,
      context: {
        eventId: input.eventId,
        service: "web",
      },
      attributes: input.attributes,
    },
    input.allowedAttributeNames,
  );
}

export async function reportBrowserErrorReport(
  report: OperationalErrorReport,
): Promise<void> {
  try {
    const runtime = await readObservabilityRuntimeContext();
    await dispatchErrorReport(runtime, report);
  } catch {
    // Error reporting must never become an application failure.
  }
}
