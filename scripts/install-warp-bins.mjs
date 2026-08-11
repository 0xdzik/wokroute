#!/usr/bin/env node
/**
 * wokroute — Warp native binary installer (npm postinstall).
 *
 * Downloads pinned official releases of `wgcf` and `wireproxy` for the host
 * OS/arch, verifies SHA-256, and installs them into `<package-root>/bin`.
 *
 * Design rules:
 *   - NEVER fails the install: every error becomes a warning + remediation
 *     hint (exit 0). Multi Warp surfaces its own actionable error at runtime.
 *   - Skippable via WOKROUTE_SKIP_WARP_BINS=1 (used by the Docker build,
 *     which compiles both binaries from vendored Go source instead).
 *   - Plain ESM using only `node:` builtins — runs under both Node and Bun.
 *
 * Usage: node scripts/install-warp-bins.mjs [--force]
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { arch as osArch, platform as osPlatform, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ── Pinned upstream releases ────────────────────────────────────────────────
// Checksums taken from each release's official checksums.txt.

export const WGCF_VERSION = "2.2.32";
export const WIREPROXY_VERSION = "1.1.3";

export const WGCF_RELEASE_BASE = `https://github.com/ViRb3/wgcf/releases/download/v${WGCF_VERSION}`;
export const WIREPROXY_RELEASE_BASE = `https://github.com/windtf/wireproxy/releases/download/v${WIREPROXY_VERSION}`;

/** SHA-256 of the bare wgcf release binaries, keyed `<os>_<arch>`. */
export const WGCF_SHA256 = {
  darwin_amd64: "5d977de53c171cfd4fa07ea281ceb89e424c8d643bd9e3263be22820f15ce84b",
  darwin_arm64: "6c19e27eefcade597f3778f5fdcbd0a5f5297e9ff343cbb44cc206e21d83d48fb",
  linux_amd64: "2ff97f2201972ce582a424455d50a3719a380eef0cd1f3144f7779348e122a2c",
  linux_arm64: "21fe21d9f61db9b381d71200f6f59c7949e0bb455446edcb33dda6ad6a8fcf8f",
  windows_amd64: "2b3648a5d39550b6423be562e619805ed9f7a64bcda51cf36c60caeba97b1777",
  windows_arm64: "c360793639ffa39c89a4f54b2e8cfd25ebae7a6dc48229a5a4d23828d67e52fe",
};

/** SHA-256 of the wireproxy release tarballs, keyed `<os>_<arch>`. */
export const WIREPROXY_SHA256 = {
  darwin_amd64: "5d89742a0f381d9508d3ad828a0d300dceee24fa49015427eaff42a23f7a50bd",
  darwin_arm64: "28d34342c48c309b628d9c06ab4efc05b82fba49821f360605c02139c02547a5",
  linux_amd64: "e88c1d090740373fc606c1bafd81d9a5eadc642cce5667616e20e9d7a444f51c",
  linux_arm64: "370e00bd2167960d1ecd1c3c1439715bbaa94a0a110a2040468670c9af6021b6",
  windows_amd64: "bce041ea9fe0f8a3351301dcbe29cdf6a523bb25cf9c62f17ebb5699a8051d0f",
};

// ── Pure planning helpers (unit-tested) ─────────────────────────────────────

/**
 * Map a Node platform/arch pair to the upstream `<os>_<arch>` release key,
 * or null when the platform has no official release assets.
 */
export function platformKey(platform = osPlatform(), arch = osArch()) {
  const os = platform === "win32" ? "windows" : platform;
  const cpu = arch === "x64" || arch === "amd64" ? "amd64" : arch === "arm64" ? "arm64" : null;
  if (cpu === null || !["darwin", "linux", "windows"].includes(os)) return null;
  return `${os}_${cpu}`;
}

/** SHA-256 hex digest of a buffer. */
export function sha256Hex(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Build the download plan for a host. Returns `{ key, downloads, notes }`:
 * `downloads` lists what to fetch (with pinned URLs + checksums); `notes`
 * carries human-readable caveats (e.g. wireproxy has no windows_arm64 asset).
 */
export function planDownloads(platform = osPlatform(), arch = osArch()) {
  const key = platformKey(platform, arch);
  const notes = [];
  if (!key) {
    notes.push(
      `Unsupported platform ${platform}/${arch} — install wgcf and wireproxy manually, ` +
        "then set WOKROUTE_WGCF_BIN / WOKROUTE_WIREPROXY_BIN.",
    );
    return { key: null, downloads: [], notes };
  }

  const exe = key.startsWith("windows") ? ".exe" : "";
  const downloads = [];

  const wgcfSha = WGCF_SHA256[key];
  if (wgcfSha) {
    downloads.push({
      name: "wgcf",
      kind: "binary",
      url: `${WGCF_RELEASE_BASE}/wgcf_${WGCF_VERSION}_${key}${exe}`,
      sha256: wgcfSha,
      targetFile: `wgcf${exe}`,
    });
  } else {
    notes.push(`No official wgcf release asset for ${key} — set WOKROUTE_WGCF_BIN manually.`);
  }

  const wireproxySha = WIREPROXY_SHA256[key];
  if (wireproxySha) {
    downloads.push({
      name: "wireproxy",
      kind: "tar.gz",
      url: `${WIREPROXY_RELEASE_BASE}/wireproxy_${key}.tar.gz`,
      sha256: wireproxySha,
      targetFile: `wireproxy${exe}`,
      innerFile: `wireproxy${exe}`,
    });
  } else {
    notes.push(`No official wireproxy release asset for ${key} — set WOKROUTE_WIREPROXY_BIN manually.`);
  }

  return { key, downloads, notes };
}

// ── Install mechanics ───────────────────────────────────────────────────────

async function fileExists(path) {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

async function fetchBuffer(url) {
  if (typeof fetch !== "function") {
    throw new Error("global fetch is unavailable — Node >= 18 or Bun is required");
  }
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Write via a temp file + rename so a partial download never shadows the target. */
async function writeAtomic(target, body) {
  const tmp = `${target}.tmp-${process.pid}`;
  await writeFile(tmp, body);
  await rename(tmp, target);
}

/** Extract a single named file from a .tar.gz buffer and install it at `target`. */
async function extractTarGz(body, innerFile, target) {
  const workDir = await mkdtemp(join(tmpdir(), "wokroute-warp-"));
  const archive = join(workDir, "archive.tar.gz");
  try {
    await writeFile(archive, body);
    const res = spawnSync("tar", ["-xzf", archive, "-C", workDir], { stdio: "ignore" });
    if (res.error) throw new Error(`tar unavailable: ${res.error.message}`);
    if (res.status !== 0) throw new Error(`tar exited with code ${res.status}`);
    const extracted = join(workDir, innerFile);
    if (!(await fileExists(extracted))) {
      throw new Error(`expected \`${innerFile}\` inside the archive but it was not found`);
    }
    await writeAtomic(target, await readFile(extracted));
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  if (process.env.WOKROUTE_SKIP_WARP_BINS && process.env.WOKROUTE_SKIP_WARP_BINS !== "0") {
    console.log("[wokroute] WOKROUTE_SKIP_WARP_BINS set — skipping Warp binary download.");
    return;
  }

  const force = process.argv.includes("--force") || process.argv.includes("-f");
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const binDir = resolve(scriptDir, "..", "bin");
  const { key, downloads, notes } = planDownloads();

  console.log(`[wokroute] Warp binary installer (target: ${binDir})`);
  for (const note of notes) console.warn(`[wokroute] WARN ${note}`);
  if (!key || downloads.length === 0) return;

  await mkdir(binDir, { recursive: true });

  let installed = 0;
  for (const dl of downloads) {
    const target = join(binDir, dl.targetFile);
    try {
      if (!force && (await fileExists(target))) {
        console.log(`[wokroute] ${dl.name}: already present at ${target} (use --force to re-download)`);
        installed += 1;
        continue;
      }
      console.log(`[wokroute] ${dl.name}: downloading ${dl.url}`);
      const body = await fetchBuffer(dl.url);
      const digest = sha256Hex(body);
      if (digest !== dl.sha256.toLowerCase()) {
        throw new Error(`SHA-256 mismatch — expected ${dl.sha256}, got ${digest}`);
      }
      if (dl.kind === "binary") {
        await writeAtomic(target, body);
      } else {
        await extractTarGz(body, dl.innerFile, target);
      }
      if (process.platform !== "win32") await chmod(target, 0o755);
      console.log(`[wokroute] ${dl.name}: installed ${target}`);
      installed += 1;
    } catch (error) {
      console.error(`[wokroute] WARN failed to install ${dl.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (installed < downloads.length) {
    console.error("[wokroute] WARN not all Warp binaries could be installed — Multi Warp will not work yet.");
    console.error("[wokroute] Fix: re-run `node scripts/install-warp-bins.mjs --force`, or install the binaries");
    console.error("[wokroute] manually and point WOKROUTE_WGCF_BIN / WOKROUTE_WIREPROXY_BIN at them.");
  }
}

// Direct-execution guard that works under both Node and Bun (import.meta.main
// is not available on all supported Node versions, so compare argv[1]).
const invokedDirectly = (() => {
  try {
    return process.argv[1] ? resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url)) : false;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  main()
    .catch((error) => {
      console.error(`[wokroute] WARN Warp binary installer failed: ${error instanceof Error ? error.message : String(error)}`);
    })
    .finally(() => {
      // Never block `npm install` on binary provisioning.
      process.exit(0);
    });
}
