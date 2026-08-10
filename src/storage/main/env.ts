/**
 * Persistence environment — bounded, lazily-parsed path and retention config.
 *
 * Config state lives in `DATA_DIR/wokroute.sqlite`, runtime telemetry in the
 * separate `DATA_DIR/runtime.sqlite`; both stay under the deployment
 * persistence boundary and are never merged. Retention windows are clamped so
 * a misconfigured environment can never disable cleanup or scan unbounded
 * history.
 */

import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

export interface PersistenceEnv {
  /** Deployment persistence boundary (production mounts this at /app/data). */
  readonly dataDir: string;
  /** Configuration database (settings, providers, accounts, keys, health). */
  readonly dbPath: string;
  /** Runtime telemetry database (request metadata, console logs). */
  readonly runtimeDbPath: string;
  /** Legacy asset file directory (retention cleanup target only). */
  readonly assetDir: string;
  /** Retention cutoff (days) for request history and console logs. */
  readonly logRetentionDays: number;
  /** Retention cutoff (days) for legacy asset rows/files. */
  readonly assetRetentionDays: number;
  /** Default per-IP concurrent proxy request cap (console-overridable). */
  readonly maxFlightsPerIp: number;
}

function boundedDays(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const clamped = Math.min(Math.max(Math.floor(parsed), 1), 365);
  return Number.isFinite(clamped) ? clamped : fallback;
}

function boundedMaxFlights(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const clamped = Math.min(Math.max(Math.floor(parsed), 1), 10_000);
  return Number.isFinite(clamped) ? clamped : fallback;
}

/** Per-user data dir so a globally-installed `wokroute` keeps state regardless
 *  of cwd. Docker sets `DATA_DIR=/app/data` in env, so this is never reached
 *  in container deployments. */
function perUserDataDir(): string | null {
  const home = homedir();
  if (!home) return null;
  switch (process.platform) {
    case "darwin": return join(home, "Library", "Application Support", "wokroute");
    case "win32":  return join(Bun.env.APPDATA ?? join(home, "AppData", "Roaming"), "wokroute");
    default:       return join(Bun.env.XDG_DATA_HOME ?? join(home, ".local", "share"), "wokroute");
  }
}

function resolvePaths(): { dataDir: string; dbPath: string; runtimeDbPath: string; assetDir: string } {
  const e = Bun.env;
  const dataDir = e.DATA_DIR
    ?? (e.NODE_ENV === "test"
        ? join(tmpdir(), `wokroute-test-${process.pid}`)
        : (perUserDataDir() ?? join(process.cwd(), "data")));
  return {
    dataDir,
    dbPath: e.DB_PATH ?? join(dataDir, "wokroute.sqlite"),
    runtimeDbPath: e.RUNTIME_DB_PATH ?? join(dataDir, "runtime.sqlite"),
    assetDir: e.ASSET_DIR ?? join(dataDir, "assets"),
  };
}

/** Parses persistence config from the process environment (cheap, no I/O). */
export function getPersistenceEnv(): PersistenceEnv {
  const paths = resolvePaths();
  return {
    dataDir: paths.dataDir,
    dbPath: paths.dbPath,
    runtimeDbPath: paths.runtimeDbPath,
    assetDir: paths.assetDir,
    logRetentionDays: boundedDays(Bun.env.LOG_RETENTION_DAYS, 14),
    assetRetentionDays: boundedDays(Bun.env.ASSET_RETENTION_DAYS, 7),
    maxFlightsPerIp: boundedMaxFlights(Bun.env.MAX_FLIGHTS_PER_IP, 15),
  };
}
