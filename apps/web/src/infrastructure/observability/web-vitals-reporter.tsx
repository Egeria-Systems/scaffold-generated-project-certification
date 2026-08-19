"use client";

import { useReportWebVitals } from "next/web-vitals";

import { reportWebVital } from "./browser-reporter";

type WebVitalMetric = Parameters<
  Parameters<typeof useReportWebVitals>[0]
>[0];

function handleWebVital(metric: WebVitalMetric): void {
  reportWebVital({
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    rating: metric.rating,
    navigationType: metric.navigationType,
  });
}

export function WebVitalsReporter() {
  useReportWebVitals(handleWebVital);
  return null;
}
