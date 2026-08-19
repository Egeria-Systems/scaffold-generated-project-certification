import type { Instrumentation } from "next";

import { reportServerError } from "./src/infrastructure/observability/server-reporter";

function readFrameworkField(value: unknown, key: string): unknown {
  try {
    return typeof value === "object" && value !== null
      ? Reflect.get(value, key)
      : undefined;
  } catch {
    return undefined;
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  await reportServerError(error, {
    requestMethod: readFrameworkField(request, "method"),
    routerKind: readFrameworkField(context, "routerKind"),
    routePath: readFrameworkField(context, "routePath"),
    routeType: readFrameworkField(context, "routeType"),
    renderSource: readFrameworkField(context, "renderSource"),
    renderType: readFrameworkField(context, "renderType"),
    revalidateReason: readFrameworkField(context, "revalidateReason"),
  });
};
