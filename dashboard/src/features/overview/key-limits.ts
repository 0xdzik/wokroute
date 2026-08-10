/** API key limit parsing/formatting — builds the PATCH/POST payload for key limits. */

import { formatTokens } from "../../lib/format";
import type { ApiKeyRecord, KeyLimitsInput, TokenBudgetMode } from "./types";

function parseOptionalLimit(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
}

function normalizeList(values: string[]): string[] | undefined {
  const items = [...new Set(values.map((entry) => entry.trim()).filter(Boolean))];
  return items.length > 0 ? items : undefined;
}

export function buildKeyLimitsInput(
  rpm: string,
  daily: string,
  monthly: string,
  concurrent: string,
  allowed: string[],
  providerIds: Set<string>,
  oneTime = "",
  budgetMode: TokenBudgetMode = "recurring",
): KeyLimitsInput {
  const input: KeyLimitsInput = {};
  const rateLimitRpm = parseOptionalLimit(rpm);
  const dailyTokenLimit = parseOptionalLimit(daily);
  const monthlyTokenLimit = parseOptionalLimit(monthly);
  const oneTimeTokenLimit = parseOptionalLimit(oneTime);
  const maxConcurrentRequests = parseOptionalLimit(concurrent);
  // Auto-detect: a bare (no "/") entry is a provider ACL entry only when it's
  // an actual registered provider id. A bare alias or combo name (also no
  // "/") is NOT a provider - it used to be misclassified into
  // providerAllowlist here, which silently broke its ACL (a qualified
  // request never matches a provider id that's really an alias name, and a
  // bare alias request skips the providerAllowlist check entirely since it
  // has no provider prefix to check against - modelAllowlist is the only
  // list that gates it correctly).
  const allAllowed = normalizeList(allowed);
  const providerAllowlist = allAllowed ? allAllowed.filter((e) => !e.includes("/") && providerIds.has(e)) : undefined;
  const modelAllowlist = allAllowed ? allAllowed.filter((e) => e.includes("/") || !providerIds.has(e)) : undefined;
  if (rateLimitRpm) input.rateLimitRpm = rateLimitRpm;
  if (budgetMode === "one-time") {
    if (oneTimeTokenLimit) input.oneTimeTokenLimit = oneTimeTokenLimit;
  } else {
    if (dailyTokenLimit) input.dailyTokenLimit = dailyTokenLimit;
    if (monthlyTokenLimit) input.monthlyTokenLimit = monthlyTokenLimit;
  }
  if (maxConcurrentRequests) input.maxConcurrentRequests = maxConcurrentRequests;
  if (providerAllowlist?.length) input.providerAllowlist = providerAllowlist;
  if (modelAllowlist?.length) input.modelAllowlist = modelAllowlist;
  return input;
}

export function formatKeyLimits(key: ApiKeyRecord): string {
  const parts: string[] = [];
  if (key.rateLimitRpm) parts.push(`${key.rateLimitRpm} rpm`);
  if (key.dailyTokenLimit) parts.push(`${formatTokens(key.dailyTokenLimit)}/day`);
  if (key.monthlyTokenLimit) parts.push(`${formatTokens(key.monthlyTokenLimit)}/mo`);
  if (key.oneTimeTokenLimit) parts.push(`${formatTokens(key.oneTimeTokensRemaining ?? key.oneTimeTokenLimit)} remaining once`);
  if (key.maxConcurrentRequests) parts.push(`${key.maxConcurrentRequests} concurrent`);
  if (key.modelAllowlist?.length) parts.push(`${key.modelAllowlist.length} allowed`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}
