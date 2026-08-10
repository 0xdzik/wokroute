/** Overview response validation — normalizes the console /overview payload. */

import type { OverviewData, ProviderOverview } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Validates and normalizes the current console overview response shape. */
export function parseOverviewData(value: unknown): OverviewData | null {
  if (!isRecord(value) || !Array.isArray(value.registered) || !value.registered.every((item) => typeof item === "string") || !Array.isArray(value.providers) || !isRecord(value.totals)) return null;
  const totals = value.totals;
  const totalKeys: (keyof OverviewData["totals"])[] = ["requests", "inputTokens", "cachedTokens", "outputTokens", "errors"];
  if (!totalKeys.every((key) => isFiniteNumber(totals[key]))) return null;
  const requests = totals.requests;
  const inputTokens = totals.inputTokens;
  const cachedTokens = totals.cachedTokens;
  const outputTokens = totals.outputTokens;
  const errors = totals.errors;
  const avgDurationMs = isFiniteNumber(totals.avgDurationMs) ? totals.avgDurationMs : 0;
  const estimatedCostUsd = isFiniteNumber(totals.estimatedCostUsd) ? totals.estimatedCostUsd : 0;
  if (!isFiniteNumber(requests) || !isFiniteNumber(inputTokens) || !isFiniteNumber(cachedTokens) || !isFiniteNumber(outputTokens) || !isFiniteNumber(errors)) return null;
  const providers: ProviderOverview[] = [];
  for (const item of value.providers) {
    if (!isRecord(item) || typeof item.providerId !== "string" || !isFiniteNumber(item.requests) || !isFiniteNumber(item.inputTokens) || !isFiniteNumber(item.cachedTokens) || !isFiniteNumber(item.outputTokens) || !isFiniteNumber(item.errors)) return null;
    providers.push({ id: item.providerId, prefix: item.providerId, status: item.errors > 0 ? "warn" : "ok", requestsToday: item.requests, input: item.inputTokens, cached: item.cachedTokens, output: item.outputTokens, errors: item.errors, lastError: null });
  }
  return {
    totals: {
      requests,
      inputTokens,
      cachedTokens,
      outputTokens,
      errors,
      avgDurationMs,
      estimatedCostUsd,
    },
    providers,
    registered: value.registered,
  };
}
