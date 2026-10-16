import type { Instrumentation } from "next";

/** Server errors from any route land in one structured, PII-redacted log line. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { captureError } = await import("./lib/log");
  captureError(err, { path: request.path, method: request.method, route: context.routePath, kind: context.routeType });
};
