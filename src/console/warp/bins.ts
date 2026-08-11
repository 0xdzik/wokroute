/**
 * Native binary resolution for the Warp toolchain (`wgcf`, `wireproxy`).
 *
 * The binaries are provisioned by `scripts/install-warp-bins.mjs` (npm
 * postinstall) into `<package-root>/bin`. They are NOT resolved against
 * `process.cwd()` alone — a globally-installed `wokroute` may be launched
 * from any directory.
 *
 * Resolution order:
 *   1. Explicit override env (`WOKROUTE_WGCF_BIN` / `WOKROUTE_WIREPROXY_BIN`)
 *   2. `<package-root>/bin/<name>` — stable regardless of cwd
 *   3. `<cwd>/bin/<name>` — legacy/dev convenience (repo checkouts)
 *   4. `$PATH` lookup — system-installed binaries
 */

import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

export type NativeBinName = "wgcf" | "wireproxy";

/** Env vars that pin an explicit binary path, per tool. */
export const OVERRIDE_ENV: Record<NativeBinName, string> = {
  wgcf: "WOKROUTE_WGCF_BIN",
  wireproxy: "WOKROUTE_WIREPROXY_BIN",
};

/** Package root: this file lives in `src/console/warp/` → three levels up. */
export const PACKAGE_ROOT = join(import.meta.dir, "..", "..", "..");

/** Injectable resolution context (tests override every field). */
export interface NativeBinContext {
  readonly env?: { [key: string]: string | undefined };
  readonly cwd?: string;
  readonly packageRoot?: string;
  readonly platform?: NodeJS.Platform;
  readonly exists?: (path: string) => boolean;
}

/** Raised when no candidate binary can be found; message carries remediation. */
export class WarpBinaryError extends Error {
  readonly binaryName: NativeBinName;

  constructor(binaryName: NativeBinName, searched: readonly string[]) {
    const lines = [
      `Multi Warp requires the native \`${binaryName}\` binary, which was not found.`,
      "",
      "Searched:",
      ...searched.map((p) => `  - ${p}`),
      "",
      "To fix:",
      "  - Auto-install: run `node scripts/install-warp-bins.mjs --force` inside the wokroute package",
      `    (npm global install: node "$(npm root -g)/wokroute/scripts/install-warp-bins.mjs" --force)`,
      `  - Or install \`${binaryName}\` yourself and set ${OVERRIDE_ENV[binaryName]}=/path/to/${binaryName}`,
    ];
    super(lines.join("\n"));
    this.name = "WarpBinaryError";
    this.binaryName = binaryName;
  }
}

/**
 * Resolve the path to a native Warp binary for the current host.
 * Throws `WarpBinaryError` with actionable remediation when nothing is found.
 */
export function resolveNativeBin(name: NativeBinName, ctx: NativeBinContext = {}): string {
  const env = ctx.env ?? Bun.env;
  const platform = ctx.platform ?? process.platform;
  const cwd = ctx.cwd ?? process.cwd();
  const packageRoot = ctx.packageRoot ?? PACKAGE_ROOT;
  const exists = ctx.exists ?? ((p: string) => existsSync(p));
  const exe = platform === "win32" ? ".exe" : "";
  const fileName = `${name}${exe}`;

  // 1. Explicit override — trust it, but fail loudly if it points nowhere.
  const override = env[OVERRIDE_ENV[name]]?.trim();
  if (override) {
    if (exists(override)) return override;
    throw new WarpBinaryError(name, [`${override} (${OVERRIDE_ENV[name]} override — file does not exist)`]);
  }

  // 2. Package-root bin/ + 3. legacy <cwd>/bin/.
  const searched: string[] = [];
  const candidates = [join(packageRoot, "bin", fileName), join(cwd, "bin", fileName)];
  for (const candidate of candidates) {
    searched.push(candidate);
    if (exists(candidate)) return candidate;
  }

  // 4. $PATH lookup.
  const pathEnv = env.PATH ?? env.Path ?? "";
  // Split with the TARGET platform's delimiter so an injected win32 context
  // parses `Path` entries correctly even when tests run on POSIX hosts.
  const pathDelimiter = platform === "win32" ? ";" : delimiter;
  const pathDirs = pathEnv.split(pathDelimiter).filter((dir) => dir.length > 0);
  for (const dir of pathDirs) {
    const candidate = join(dir, fileName);
    if (exists(candidate)) return candidate;
  }
  if (pathDirs.length > 0) searched.push(`$PATH (${pathDirs.length} directories)`);

  throw new WarpBinaryError(name, searched);
}

/** Resolve the `wgcf` binary for the current host. */
export function resolveWgcfBin(): string {
  return resolveNativeBin("wgcf");
}

/** Resolve the `wireproxy` binary for the current host. */
export function resolveWireProxyBin(): string {
  return resolveNativeBin("wireproxy");
}
