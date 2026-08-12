/**
 * Read-only console diagnostics.
 *
 * Everything in this module is a query: runtime metadata, process health,
 * bounded account/proxy health with failed/replacement route payloads,
 * model-route simulation and provider health checks. No function here writes
 * configuration or telemetry state, and
 * none of them read provider credentials. Request-history rows expose only
 * compact scalar metadata (`clientName`/`clientSource` labels included);
 * raw headers, user-agent strings, prompt markers, and request content are
 * never available through the console.
 */

import { cpus, freemem, networkInterfaces, totalmem } from "node:os";
import type { TrafficWindow } from "../storage";
import packageJson from "../../package.json";
import type { ProviderRegistry } from "../providers/registry";
import { scheduleGlobalGc, type GcScheduleResult } from "../traffic/memory";
import { resolveModelChain, type ChainResult, type ModelReferenceConfig } from "../domain/routing";
import type {
  ConsoleLogLine,
  ConsoleRepositories,
  ConsoleServices,
  ConsoleRuntimeSettings,
  IpSummaryView,
  ProviderTodayView,
  RequestHistoryFilters,
  RequestHistoryRow,
  UsageDimension,
  UsagePeriod,
  UsageSummaryView,
} from "./services";

const SERVER_STARTED_AT = Date.now();
const CPU_INFO = cpus();

let lastCpuUsage: NodeJS.CpuUsage | undefined;
let lastSampleAt: number | undefined;

/** CPU% since the previous sample (0 on the first call after cold start). */
function sampleCpuPercent(): number {
  const now = performance.now();
  const usage = process.cpuUsage();
  if (lastCpuUsage === undefined || lastSampleAt === undefined) {
    lastCpuUsage = usage;
    lastSampleAt = now;
    return 0;
  }
  const elapsedMs = now - lastSampleAt;
  const deltaCpuUs = usage.user - lastCpuUsage.user + (usage.system - lastCpuUsage.system);
  lastCpuUsage = usage;
  lastSampleAt = now;
  if (elapsedMs <= 0) return 0;
  const coreCount = Math.max(1, CPU_INFO.length);
  const percent = ((deltaCpuUs / 1000) / elapsedMs) * 100 / coreCount;
  return Math.min(100, Math.max(0, Math.round(percent * 10) / 10));
}

function memorySnapshot(): ResourceSnapshot {
  const mem = process.memoryUsage();
  const total = totalmem();
  const free = freemem();
  const toMb = (bytes: number): number => Math.round((bytes / 1024 / 1024) * 10) / 10;
  return {
    memoryUsedMb: toMb(mem.rss),
    memorySystemUsedMb: toMb(total - free),
    memoryTotalMb: Math.round(total / 1024 / 1024),
    heapUsedMb: toMb(mem.heapUsed),
    heapTotalMb: toMb(mem.heapTotal),
    externalMb: toMb(mem.external),
    arrayBuffersMb: toMb(mem.arrayBuffers),
    cpuPercent: sampleCpuPercent(),
    coreCount: CPU_INFO.length,
    pid: process.pid,
  };
}

export interface StatusView {
  readonly version: string;
  readonly startedAt: number;
  readonly uptimeSeconds: number;
  readonly now: number;
  readonly timezoneOffsetMinutes: number;
}

interface ResourceSnapshot {
  readonly memoryUsedMb: number;
  readonly memorySystemUsedMb: number;
  readonly memoryTotalMb: number;
  readonly heapUsedMb: number;
  readonly heapTotalMb: number;
  readonly externalMb: number;
  readonly arrayBuffersMb: number;
  readonly cpuPercent: number;
  readonly coreCount: number;
  readonly pid: number;
}

export interface MetricsView extends ResourceSnapshot {
  readonly trafficWindowMs: number;
  readonly trafficRequests: number;
  readonly trafficErrors: number;
  readonly trafficP95Ms: number;
  readonly trafficRatePerSec: number;
}

/** Rolling window behind the Traffic health card; cached to match the 5s poll. */
const TRAFFIC_WINDOW_MS = 60_000;
const TRAFFIC_TTL_MS = 5_000;

export interface ResolvePreviewView {
  readonly ok: boolean;
  readonly trace: readonly string[];
  readonly resolved: ChainResult;
}

export interface OverviewView {
  readonly totals: UsageSummaryView;
  readonly inFlight: number;
  readonly providers: readonly ProviderTodayView[];
  readonly proxyAuthMode: ConsoleRuntimeSettings["proxyAuthMode"];
  readonly registered: readonly string[];
}

export interface ConsoleDiagnosticsOptions {
  readonly services: ConsoleServices;
  readonly repositories: ConsoleRepositories;
  readonly registry: ProviderRegistry;
  /** Provider prefix â†’ provider id map used for model reference parsing (lead-wired). */
  readonly prefixes?: ReadonlyMap<string, string>;
  /** Optional live counters supplied by the composition layer. */
  readonly runtimeCounters?: { readonly inFlight: () => number };
}

const MAX_REQUEST_LIMIT = 200;
const MAX_LOG_LIMIT = 1000;

function boundedLimit(value: unknown, fallback: number, maximum: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(Math.max(Math.floor(value), 1), maximum) : fallback;
}

function boundedPeriod(value: unknown): UsagePeriod {
  return value === "1h" || value === "7d" || value === "30d" || value === "24h" || value === "all" ? value : "24h";
}

export class ConsoleDiagnostics {
  private readonly services: ConsoleServices;
  private readonly repositories: ConsoleRepositories;
  private readonly registry: ProviderRegistry;
  private readonly prefixes: ReadonlyMap<string, string>;
  private readonly runtimeCounters: { readonly inFlight: () => number } | null;
  private cachedTraffic: { value: TrafficWindow | null; at: number } = { value: null, at: 0 };

  constructor(options: ConsoleDiagnosticsOptions) {
    this.services = options.services;
    this.repositories = options.repositories;
    this.registry = options.registry;
    this.prefixes = options.prefixes ?? new Map<string, string>();
    this.runtimeCounters = options.runtimeCounters ?? null;
  }

  status(): StatusView {
    const now = Date.now();
    return {
      version: typeof packageJson.version === "string" ? packageJson.version : "unknown",
      startedAt: SERVER_STARTED_AT,
      uptimeSeconds: Math.floor((now - SERVER_STARTED_AT) / 1000),
      now,
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    };
  }

  async metrics(): Promise<MetricsView> {
    return { ...memorySnapshot(), ...ConsoleDiagnostics.trafficFields(await this.trafficSnapshot()) };
  }

  async gc(): Promise<{ before: MetricsView; after: MetricsView; gc: GcScheduleResult }> {
    const traffic = ConsoleDiagnostics.trafficFields(await this.trafficSnapshot());
    const before = { ...memorySnapshot(), ...traffic };
    const gc = scheduleGlobalGc();
    const after = { ...memorySnapshot(), ...traffic };
    return { before, after, gc };
  }

  /** Rolling-window traffic stats, cached so the 5s poll hits SQLite at most once per TTL. */
  private async trafficSnapshot(): Promise<TrafficWindow | null> {
    const now = Date.now();
    if (this.cachedTraffic.value !== null && now - this.cachedTraffic.at < TRAFFIC_TTL_MS) return this.cachedTraffic.value;
    let value: TrafficWindow | null = null;
    try {
      value = await this.repositories.runtimeMetadata.trafficWindow(TRAFFIC_WINDOW_MS);
    } catch {
      value = null;
    }
    this.cachedTraffic = { value, at: now };
    return value;
  }

  private static trafficFields(traffic: TrafficWindow | null): Pick<MetricsView, "trafficWindowMs" | "trafficRequests" | "trafficErrors" | "trafficP95Ms" | "trafficRatePerSec"> {
    const windowMs = traffic?.windowMs ?? TRAFFIC_WINDOW_MS;
    const requests = traffic?.requests ?? 0;
    return {
      trafficWindowMs: windowMs,
      trafficRequests: requests,
      trafficErrors: traffic?.errors ?? 0,
      trafficP95Ms: traffic?.p95DurationMs ?? 0,
      trafficRatePerSec: Math.round((requests / (windowMs / 1000)) * 10) / 10,
    };
  }

  localIps(): readonly string[] {
    const nets = networkInterfaces();
    const ips: string[] = [];
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] ?? []) {
        if (!net.internal && net.family === "IPv4") ips.push(net.address);
      }
    }
    return ips;
  }

  // -------------------------------------------------------------------------
  // Runtime metadata (read-only)
  // -------------------------------------------------------------------------

  async requestHistory(rawFilters: unknown): Promise<{ readonly items: readonly RequestHistoryRow[]; readonly nextCursor: string | null }> {
    const filters: {
      period: UsagePeriod;
      limit: number;
      providerId?: string;
      model?: string;
      apiKeyId?: string;
      status?: "ok" | "error";
      cursor?: string;
      clientIp?: string;
    } = { period: "24h", limit: 50 };
    if (typeof rawFilters === "object" && rawFilters !== null) {
      const value = rawFilters as Record<string, unknown>;
      filters.period = boundedPeriod(value.period);
      if (typeof value.providerId === "string") filters.providerId = value.providerId;
      if (typeof value.model === "string") filters.model = value.model;
      if (typeof value.apiKeyId === "string") filters.apiKeyId = value.apiKeyId;
      if (value.status === "ok" || value.status === "error") filters.status = value.status;
      if (typeof value.cursor === "string") filters.cursor = value.cursor;
      if (typeof value.clientIp === "string") filters.clientIp = value.clientIp;
      filters.limit = boundedLimit(value.limit, 50, MAX_REQUEST_LIMIT);
    }
    return this.repositories.runtimeMetadata.queryRequests(filters);
  }

  async requestDetail(requestId: string): Promise<RequestHistoryRow | null> {
    return this.repositories.runtimeMetadata.getRequest(requestId);
  }

  async usageSummary(period: unknown): Promise<UsageSummaryView> {
    return this.repositories.runtimeMetadata.queryUsageSummary(boundedPeriod(period));
  }

  async providerToday(): Promise<readonly ProviderTodayView[]> {
    return this.repositories.runtimeMetadata.queryProviderToday();
  }

  async queryIpSummary(limit: number): Promise<readonly IpSummaryView[]> {
    return this.repositories.runtimeMetadata.queryIpSummary(limit);
  }

  async usageCache(period: unknown) {
    return this.repositories.runtimeMetadata.queryUsageCache(boundedPeriod(period));
  }

  async usageChart(period: unknown) {
    return this.repositories.runtimeMetadata.queryUsageChart(boundedPeriod(period));
  }

  async usageBy(dimension: UsageDimension, period: unknown) {
    return this.repositories.runtimeMetadata.queryUsageBy(dimension, boundedPeriod(period));
  }

  async logs(limit: unknown): Promise<readonly ConsoleLogLine[]> {
    return this.repositories.runtimeMetadata.queryLogs(boundedLimit(limit, 200, MAX_LOG_LIMIT));
  }

  async overview(): Promise<OverviewView> {
    const [totals, providers, settings] = await Promise.all([
      this.repositories.runtimeMetadata.queryUsageSummary("24h"),
      this.repositories.runtimeMetadata.queryProviderToday(),
      this.services.settings.get(),
    ]);
    return {
      totals,
      inFlight: this.runtimeCounters?.inFlight() ?? 0,
      providers,
      proxyAuthMode: settings.runtime.proxyAuthMode,
      registered: this.registry.list().map((adapter) => adapter.metadata.id),
    };
  }

  // -------------------------------------------------------------------------
  // Route simulation and provider health (read-only)
  // -------------------------------------------------------------------------

  /**
   * Resolves a model reference through the same pure chain used by the data
   * plane. Read-only: no credentials are read and no state is written.
   */
  async resolvePreview(model: unknown): Promise<ResolvePreviewView> {
    if (typeof model !== "string" || model.trim().length === 0) {
      return { ok: false, trace: ["model name is required"], resolved: { kind: "unresolved" } };
    }
    const [aliases, combos] = await Promise.all([
      this.repositories.routing.listAliases(),
      this.repositories.routing.listCombos(),
    ]);
    const config: ModelReferenceConfig = {
      prefixes: this.prefixes,
      aliases: new Map(aliases.map((alias) => [alias.alias, alias.model])),
      combos: new Map(
        combos.map((combo) => [
          combo.name,
          { id: combo.id, models: [...combo.models], strategy: combo.strategy, stickyLimit: combo.stickyLimit },
        ]),
      ),
    };
    const resolved = resolveModelChain(model.trim(), config);
    const trace = buildResolveTrace(model.trim(), resolved);
    return { ok: resolved.kind !== "unresolved", trace, resolved };
  }

}

/** Bounded human-readable trace of a model chain resolution. */
function buildResolveTrace(rawModel: string, resolved: ChainResult): readonly string[] {
  if (resolved.kind === "qualified") {
    return [
      `parsed "${rawModel}" as provider-qualified`,
      `resolved to ${resolved.model.providerId}/${resolved.model.modelId}`,
    ];
  }
  if (resolved.kind === "combo") {
    return [
      `"${rawModel}" is a combo with ${resolved.candidates.length} candidate(s)`,
      ...resolved.candidates.map((candidate) => `- ${candidate.providerId}/${candidate.modelId}`),
    ];
  }
  return [`"${rawModel}" did not resolve to a configured provider, alias, or combo`];
}
