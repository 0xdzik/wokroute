/** Shared types for the Overview feature — mirrors console API response shapes. */

export interface ProviderOverview {
  id: string;
  prefix: string;
  status: "ok" | "warn";
  requestsToday: number;
  input: number;
  cached: number;
  output: number;
  errors: number;
  lastError: string | null;
}

export interface OverviewData {
  totals: {
    requests: number;
    inputTokens: number;
    cachedTokens: number;
    outputTokens: number;
    errors: number;
    avgDurationMs: number;
    estimatedCostUsd: number;
  };
  providers: ProviderOverview[];
  registered: string[];
}

export interface RuntimeSettings {
  proxyAuthMode: "open" | "api_key";
}

export interface SettingsResponse {
  settings: {
    runtime: RuntimeSettings;
  };
}

export interface HealthMetrics {
  memoryUsedMb: number;
  memorySystemUsedMb: number;
  memoryTotalMb: number;
  cpuPercent: number;
  heapUsedMb: number;
  heapTotalMb: number;
  externalMb: number;
  arrayBuffersMb: number;
  coreCount: number;
  cpuModel: string;
  pid: number;
  netReceivedKb: number | null;
  netSentKb: number | null;
  netTotalKb: number | null;
  netRateKbps: number | null;
}

export interface WarpMetricsSummary {
  totalRssMb: number;
  totalRxMb: number;
  totalTxMb: number;
  totalBandwidthMb: number;
  runningCount: number;
  healthyCount: number;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  active: boolean;
  rateLimitRpm: number | null;
  dailyTokenLimit: number | null;
  monthlyTokenLimit: number | null;
  oneTimeTokenLimit: number | null;
  oneTimeTokensUsed: number;
  maxConcurrentRequests: number | null;
  providerAllowlist: string[] | null;
  modelAllowlist: string[] | null;
  modelDenylist: string[] | null;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  /** Tokens (input+output) this key has used today / all-time, from in-memory usage history. */
  todayTokens: number;
  totalTokens: number;
  oneTimeTokensRemaining: number | null;
}

export type KeyUpdatePatch = {
  key?: string;
  rateLimitRpm?: number | null;
  dailyTokenLimit?: number | null;
  monthlyTokenLimit?: number | null;
  oneTimeTokenLimit?: number | null;
  maxConcurrentRequests?: number | null;
  active?: boolean;
  providerAllowlist?: string[] | null;
  modelAllowlist?: string[] | null;
  modelDenylist?: string[] | null;
};

export type KeyLimitsInput = {
  key?: string;
  rateLimitRpm?: number;
  dailyTokenLimit?: number;
  monthlyTokenLimit?: number;
  oneTimeTokenLimit?: number;
  maxConcurrentRequests?: number;
  providerAllowlist?: string[];
  modelAllowlist?: string[];
  modelDenylist?: string[];
};

export interface CreatedKey extends ApiKeyRecord {
  key: string;
  note: string;
}

export type TokenBudgetMode = "recurring" | "one-time";

export const TOKEN_PRESETS = [
  { label: "1M", value: 1_000_000 },
  { label: "10M", value: 10_000_000 },
  { label: "100M", value: 100_000_000 },
  { label: "1B", value: 1_000_000_000 },
  { label: "1T", value: 1_000_000_000_000 },
] as const;


/** Response of GET /console/api/health/update — npm registry version check. */
export type UpdateInfo = {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  checkedAt: number;
  error?: string;
};