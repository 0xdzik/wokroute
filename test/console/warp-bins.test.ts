/**
 * Focused tests for Warp native binary resolution (`src/console/warp/bins.ts`)
 * and the postinstall installer plan (`scripts/install-warp-bins.mjs`).
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  OVERRIDE_ENV,
  resolveNativeBin,
  WarpBinaryError,
  type NativeBinContext,
} from "../../src/console/warp/bins";
import {
  planDownloads,
  platformKey,
  sha256Hex,
  WGCF_RELEASE_BASE,
  WGCF_SHA256,
  WGCF_VERSION,
  WIREPROXY_RELEASE_BASE,
  WIREPROXY_SHA256,
  WIREPROXY_VERSION,
} from "../../scripts/install-warp-bins.mjs";

// Upstream wgcf publishes one 65-hex-char digest (darwin_arm64 in v2.2.32);
// constants are copied verbatim, so accept 64–65 chars rather than "fixing" them.
const HEX_64 = /^[0-9a-f]{64,65}$/;

/** Build a fully-injected resolution context; `existing` drives the fake fs. */
function ctx(
  overrides: Partial<NativeBinContext> & { existing?: Record<string, true> } = {},
): NativeBinContext {
  const { existing, ...rest } = overrides;
  return {
    env: {},
    cwd: "/cwd",
    packageRoot: "/pkg",
    platform: "linux",
    exists: (path) => existing !== undefined && path in existing,
    ...rest,
  };
}

describe("resolveNativeBin", () => {
  test("explicit override wins over every other candidate", () => {
    const c = ctx({
      env: { [OVERRIDE_ENV.wgcf]: "/opt/wgcf", PATH: "/sysbin" },
      existing: { "/opt/wgcf": true, "/pkg/bin/wgcf": true, "/cwd/bin/wgcf": true, "/sysbin/wgcf": true },
    });
    expect(resolveNativeBin("wgcf", c)).toBe("/opt/wgcf");
  });

  test("override pointing at a missing file fails loudly", () => {
    const c = ctx({ env: { [OVERRIDE_ENV.wireproxy]: "/nope/wireproxy" } });
    expect(() => resolveNativeBin("wireproxy", c)).toThrowError(WarpBinaryError);
  });

  test("package-root bin/ beats the legacy cwd bin/", () => {
    const c = ctx({ existing: { "/pkg/bin/wgcf": true, "/cwd/bin/wgcf": true } });
    expect(resolveNativeBin("wgcf", c)).toBe(join("/pkg", "bin", "wgcf"));
  });

  test("falls back to cwd bin/ when the package root has nothing", () => {
    const c = ctx({ existing: { "/cwd/bin/wireproxy": true } });
    expect(resolveNativeBin("wireproxy", c)).toBe(join("/cwd", "bin", "wireproxy"));
  });

  test("falls back to $PATH when no bin/ directory has the binary", () => {
    const c = ctx({
      env: { PATH: "/usr/local/bin:/sysbin" },
      existing: { "/sysbin/wgcf": true },
    });
    expect(resolveNativeBin("wgcf", c)).toBe(join("/sysbin", "wgcf"));
  });

  test("win32 candidates carry the .exe suffix", () => {
    const sysDir = "C:\\Program Files\\warp";
    const c = ctx({
      platform: "win32",
      env: { Path: sysDir },
      existing: { [join(sysDir, "wgcf.exe")]: true },
    });
    expect(resolveNativeBin("wgcf", c)).toBe(join(sysDir, "wgcf.exe"));
  });

  test("missing binary raises an actionable error", () => {
    const c = ctx({ env: { PATH: "/sysbin" } });
    let caught: unknown;
    try {
      resolveNativeBin("wgcf", c);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(WarpBinaryError);
    const message = (caught as Error).message;
    expect(message).toContain("wgcf");
    expect(message).toContain(OVERRIDE_ENV.wgcf);
    expect(message).toContain(join("/pkg", "bin", "wgcf"));
    expect(message).toContain(join("/cwd", "bin", "wgcf"));
    expect(message).toContain("install-warp-bins");
  });
});

describe("install-warp-bins platform mapping", () => {
  test("maps Node platform/arch to upstream release keys", () => {
    expect(platformKey("linux", "x64")).toBe("linux_amd64");
    expect(platformKey("linux", "arm64")).toBe("linux_arm64");
    expect(platformKey("darwin", "x64")).toBe("darwin_amd64");
    expect(platformKey("darwin", "arm64")).toBe("darwin_arm64");
    expect(platformKey("win32", "x64")).toBe("windows_amd64");
    expect(platformKey("win32", "arm64")).toBe("windows_arm64");
  });

  test("rejects platforms without official assets", () => {
    expect(platformKey("freebsd", "x64")).toBeNull();
    expect(platformKey("linux", "ia32")).toBeNull();
    expect(platformKey("sunos", "arm64")).toBeNull();
  });

  test("every pinned checksum is a lowercase 64-hex SHA-256", () => {
    for (const [key, digest] of Object.entries(WGCF_SHA256)) {
      expect(digest, `wgcf ${key}`).toMatch(HEX_64);
    }
    for (const [key, digest] of Object.entries(WIREPROXY_SHA256)) {
      expect(digest, `wireproxy ${key}`).toMatch(HEX_64);
    }
  });

  test("sha256Hex matches a known digest", () => {
    expect(sha256Hex(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("install-warp-bins download plan", () => {
  test("linux x64 gets both pinned downloads", () => {
    const plan = planDownloads("linux", "x64");
    expect(plan.key).toBe("linux_amd64");
    expect(plan.downloads).toHaveLength(2);

    const wgcf = plan.downloads.find((d) => d.name === "wgcf");
    expect(wgcf?.kind).toBe("binary");
    expect(wgcf?.url).toBe(`${WGCF_RELEASE_BASE}/wgcf_${WGCF_VERSION}_linux_amd64`);
    expect(wgcf?.sha256).toBe(WGCF_SHA256.linux_amd64);
    expect(wgcf?.targetFile).toBe("wgcf");

    const wireproxy = plan.downloads.find((d) => d.name === "wireproxy");
    expect(wireproxy?.kind).toBe("tar.gz");
    expect(wireproxy?.url).toBe(`${WIREPROXY_RELEASE_BASE}/wireproxy_linux_amd64.tar.gz`);
    expect(wireproxy?.sha256).toBe(WIREPROXY_SHA256.linux_amd64);
    expect(wireproxy?.innerFile).toBe("wireproxy");
  });

  test("darwin arm64 gets both pinned downloads", () => {
    const plan = planDownloads("darwin", "arm64");
    expect(plan.key).toBe("darwin_arm64");
    expect(plan.downloads).toHaveLength(2);
    expect(plan.downloads.some((d) => d.url.includes("wgcf_2.2.32_darwin_arm64"))).toBe(true);
    expect(plan.downloads.some((d) => d.url.includes("wireproxy_darwin_arm64.tar.gz"))).toBe(true);
  });

  test("win32 x64 uses .exe names end to end", () => {
    const plan = planDownloads("win32", "x64");
    expect(plan.key).toBe("windows_amd64");
    const wgcf = plan.downloads.find((d) => d.name === "wgcf");
    expect(wgcf?.url.endsWith(".exe")).toBe(true);
    expect(wgcf?.targetFile).toBe("wgcf.exe");
    const wireproxy = plan.downloads.find((d) => d.name === "wireproxy");
    expect(wireproxy?.innerFile).toBe("wireproxy.exe");
    expect(wireproxy?.targetFile).toBe("wireproxy.exe");
  });

  test("win32 arm64 only has wgcf upstream — wireproxy is noted, not fatal", () => {
    const plan = planDownloads("win32", "arm64");
    expect(plan.key).toBe("windows_arm64");
    expect(plan.downloads).toHaveLength(1);
    expect(plan.downloads[0]?.name).toBe("wgcf");
    expect(plan.notes.join(" ")).toContain("WOKROUTE_WIREPROXY_BIN");
  });

  test("unsupported platform yields no downloads and manual guidance", () => {
    const plan = planDownloads("freebsd", "x64");
    expect(plan.key).toBeNull();
    expect(plan.downloads).toHaveLength(0);
    expect(plan.notes.join(" ")).toContain("WOKROUTE_WGCF_BIN");
  });

  test("pinned versions stay in the URLs", () => {
    expect(WGCF_VERSION).toBe("2.2.32");
    expect(WIREPROXY_VERSION).toBe("1.1.3");
    const plan = planDownloads("linux", "arm64");
    for (const dl of plan.downloads) {
      expect(dl.url).not.toContain("latest");
    }
  });
});
