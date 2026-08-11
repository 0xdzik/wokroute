/**
 * Update checking against the public npm registry.
 *
 * Shared by the CLI (`wokroute update`, the interactive menu) and the console
 * backend (`GET /console/api/health/update`) — the dashboard's CSP is
 * `connect-src 'self'`, so the browser cannot reach the registry directly and
 * goes through the console API instead.
 */

import packageJson from "../package.json";

const REGISTRY_LATEST_URL = "https://registry.npmjs.org/wokroute/latest";
const FETCH_TIMEOUT_MS = 8_000;
/** Registry hits are cached for 10 minutes across dashboard loads / CLI checks. */
const CACHE_TTL_MS = 10 * 60_000;

export interface UpdateInfo {
  readonly current: string;
  readonly latest: string | null;
  readonly updateAvailable: boolean;
  readonly checkedAt: number;
  readonly error?: string;
}

export function currentVersion(): string {
  return typeof packageJson.version === "string" ? packageJson.version : "0.0.0";
}

/** Numeric semver compare: -1 when a < b, 0 when equal, 1 when a > b. */
export function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map((part) => Number.parseInt(part, 10));
  const pb = b.split(".").map((part) => Number.parseInt(part, 10));
  for (let i = 0; i < 3; i++) {
    const diff = (Number.isFinite(pa[i]) ? pa[i]! : 0) - (Number.isFinite(pb[i]) ? pb[i]! : 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

let cached: { readonly info: UpdateInfo; readonly at: number } | null = null;

/**
 * Checks the npm registry for the latest published version. Errors never throw
 * — they surface as `error` on the result so callers degrade gracefully.
 * Pass `force` to bypass the TTL cache (the CLI `update` command does).
 */
export async function checkForUpdate(force = false): Promise<UpdateInfo> {
  const now = Date.now();
  if (!force && cached !== null && now - cached.at < CACHE_TTL_MS) return cached.info;
  let info: UpdateInfo;
  try {
    const response = await fetch(REGISTRY_LATEST_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`registry HTTP ${response.status}`);
    const body = (await response.json()) as { version?: unknown };
    const latest = typeof body.version === "string" && body.version.length > 0 ? body.version : null;
    info = { current: currentVersion(), latest, updateAvailable: latest !== null && compareSemver(latest, currentVersion()) > 0, checkedAt: now };
  } catch (error) {
    info = { current: currentVersion(), latest: null, updateAvailable: false, checkedAt: now, error: error instanceof Error ? error.message : "update check failed" };
  }
  cached = { info, at: now };
  return info;
}
