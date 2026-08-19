import observabilityCopySource from "../../../content/en-CA/observability.yaml";

import {
  hasExactKeys,
  isNonEmptyString,
  isUnknownRecord,
  parseYamlContent,
} from "../../content/content-schema";

export type ErrorFallbackCopy = Readonly<{
  heading: string;
  summary: string;
  retryLabel: string;
}>;

export function parseErrorFallbackCopy(value: unknown): ErrorFallbackCopy {
  if (
    !isUnknownRecord(value) ||
    !hasExactKeys(value, ["heading", "retryLabel", "summary"]) ||
    !isNonEmptyString(value.heading) ||
    !isNonEmptyString(value.summary) ||
    !isNonEmptyString(value.retryLabel)
  ) {
    throw new TypeError("CONTENT_INVALID");
  }

  return Object.freeze({
    heading: value.heading,
    summary: value.summary,
    retryLabel: value.retryLabel,
  });
}

export function readErrorFallbackCopy(): ErrorFallbackCopy {
  return parseErrorFallbackCopy(parseYamlContent(observabilityCopySource));
}
