/**
 * wokroute CLI dispatch — argv parsing for the global-install UX layer.
 *
 *   wokroute                 foreground server (default)
 *   wokroute -d | --daemon   spawn detached background daemon + PID file
 *   wokroute stop            SIGTERM the daemon via PID file
 *   wokroute install         write + enable platform autostart (systemd/launchd/Windows)
 *   wokroute uninstall       disable + remove autostart
 *   wokroute -h | --help     usage
 *
 * No dependency — hand-rolled switch on `process.argv`. `main.ts` calls
 * `dispatch(main)`; bare invocation falls through to the server starter so
 * existing `bun run src/main.ts` / Docker `bun run start` behavior is unchanged.
 */

import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { mkdir } from "node:fs/promises";
import { getPersistenceEnv } from "./storage/main/env";

// ── helpers ────────────────────────────────────────────────────────────────

async function unlinkSafe(p: string): Promise<void> {
  try { await Bun.file(p).unlink(); } catch { /* not a problem */ }
}

/** Entry script path — `process.argv[1]` resolves to the actual entry file
 *  (main.ts) whether invoked as `bun run src/main.ts`, `bun src/main.ts`, or
 *  the npm-global `wokroute` bin. `import.meta.path` would point at cli.ts
 *  (this module), not the server entry — avoid it here. */
const EXEC = process.execPath;
const SCRIPT = process.argv[1] ?? "";

async function run(cmd: string, args: string[]): Promise<{ ok: boolean; stderr: string }> {
  const proc = Bun.spawn({ cmd: [cmd, ...args], stdout: "pipe", stderr: "pipe" });
  const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
  return { ok: code === 0, stderr };
}

// ── daemon ─────────────────────────────────────────────────────────────────

async function spawnDaemon(restArgs: string[]): Promise<void> {
  const dataDir = getPersistenceEnv().dataDir;
  const pidFile = join(dataDir, "wokroute.pid");
  await mkdir(dataDir, { recursive: true });

  // Stale/alive probe — if a live pid is recorded, refuse to double-start.
  try {
    const existing = parseInt(await Bun.file(pidFile).text(), 10);
    process.kill(existing, 0); // throws ESRCH if the pid is dead
    console.log(`[wokroute] already running, pid=${existing} (${pidFile})`);
    process.exit(0);
  } catch {
    await unlinkSafe(pidFile); // stale or missing — clear and proceed
  }

  // Detach the child so it survives the parent exiting. Bun's `Bun.spawn`
  // with `detached:true` does NOT reliably survive parent exit on all builds,
  // so we shell out to `setsid --fork` (Linux) / `nohup` (macOS) which fully
  // re-parent the child to init. Windows spawns detached directly.
  // The child writes its own PID file (see main.ts, WOKROUTE_DAEMONIZED=1),
  // so the parent does not need to know the child pid — it waits briefly for
  // the pidfile to appear instead.
  const serverArgs = restArgs.filter((a) => a !== "-d" && a !== "--daemon");
  const isWin = process.platform === "win32";
  const isMac = process.platform === "darwin";
  const cmd: string[] = isWin
    ? [EXEC, "run", SCRIPT, ...serverArgs]
    : isMac
      ? ["nohup", EXEC, "run", SCRIPT, ...serverArgs]
      : ["setsid", "--fork", EXEC, "run", SCRIPT, ...serverArgs];
  Bun.spawn({
    // ponytail: `import.meta.path` points into the single-file binary under
    // `bun build --compile`, so compiled-binary daemon is unsupported. Add a
    // `--compiled` branch when that mode is requested.
    cmd,
    stdio: ["ignore", "ignore", "ignore"],
    detached: true,
    env: { ...process.env, WOKROUTE_DAEMONIZED: "1", WOKROUTE_PIDFILE: pidFile },
    cwd: dataDir,
  });
  // Wait for the child to write its PID file (up to ~3s), then report.
  let reported = false;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      const pid = parseInt(await Bun.file(pidFile).text(), 10);
      if (Number.isFinite(pid)) {
        console.log(`[wokroute] daemon started pid=${pid}`);
        console.log(`[wokroute] pidfile=${pidFile}`);
        console.log(`[wokroute] stop with: wokroute stop`);
        reported = true;
        break;
      }
    } catch { /* pidfile not written yet */ }
  }
  if (!reported) console.error("[wokroute] daemon did not start (no pidfile within 3s)");
  process.exit(0);
}

async function stopDaemon(): Promise<void> {
  const pidFile = join(getPersistenceEnv().dataDir, "wokroute.pid");
  let pid: number;
  try {
    pid = parseInt(await Bun.file(pidFile).text(), 10);
  } catch {
    console.log("[wokroute] not running (no pidfile)");
    process.exit(0);
    return; // unreachable, satisfies type checker
  }
  try {
    process.kill(pid, "SIGTERM");
    await unlinkSafe(pidFile);
    console.log(`[wokroute] stopped pid=${pid}`);
  } catch {
    await unlinkSafe(pidFile);
    console.log(`[wokroute] stale pidfile removed (pid ${pid} not running)`);
  }
  process.exit(0);
}

// ── autostart ──────────────────────────────────────────────────────────────

function systemdPaths(): { unit: string; userFlag: string } {
  const euid = typeof process.geteuid === "function" ? process.geteuid() : -1;
  if (euid === 0) return { unit: "/etc/systemd/system/wokroute.service", userFlag: "" };
  return { unit: join(homedir(), ".config/systemd/user/wokroute.service"), userFlag: "--user" };
}

async function installSystemd(): Promise<void> {
  const { unit, userFlag } = systemdPaths();
  const dataDir = getPersistenceEnv().dataDir;
  const wantedBy = userFlag === "" ? "multi-user.target" : "default.target";
  const unitBody = `[Unit]
Description=wokroute AI proxy
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${EXEC} run ${SCRIPT}
Environment=DATA_DIR=${dataDir}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=${wantedBy}
`;
  await mkdir(dirname(unit), { recursive: true });
  await Bun.write(unit, unitBody);
  let r = await run("systemctl", [userFlag, "daemon-reload"].filter(Boolean));
  if (!r.ok) { console.error(`[wokroute] systemctl daemon-reload failed: ${r.stderr}`); process.exit(1); }
  r = await run("systemctl", [userFlag, "enable", "--now", "wokroute"].filter(Boolean));
  if (!r.ok) { console.error(`[wokroute] systemctl enable --now failed: ${r.stderr}`); process.exit(1); }
  console.log(`[wokroute] systemd unit installed: ${unit}`);
  console.log(`[wokroute] status: systemctl ${userFlag} status wokroute`);
  process.exit(0);
}

async function uninstallSystemd(): Promise<void> {
  const { unit, userFlag } = systemdPaths();
  await run("systemctl", [userFlag, "disable", "--now", "wokroute"].filter(Boolean));
  await unlinkSafe(unit);
  await run("systemctl", [userFlag, "daemon-reload"].filter(Boolean));
  console.log(`[wokroute] systemd unit removed: ${unit}`);
  process.exit(0);
}

function launchdPlist(): string {
  return join(homedir(), "Library/LaunchAgents/com.wokroute.plist");
}

async function installLaunchd(): Promise<void> {
  const plist = launchdPlist();
  const dataDir = getPersistenceEnv().dataDir;
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.wokroute</string>
  <key>ProgramArguments</key><array>
    <string>${EXEC}</string><string>run</string><string>${SCRIPT}</string>
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>DATA_DIR</key><string>${dataDir}</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>
`;
  await mkdir(dirname(plist), { recursive: true });
  await Bun.write(plist, body);
  const r = await run("launchctl", ["load", plist]);
  if (!r.ok) { console.error(`[wokroute] launchctl load failed: ${r.stderr}`); process.exit(1); }
  console.log(`[wokroute] launchd agent installed: ${plist}`);
  console.log(`[wokroute] status: launchctl list | grep wokroute`);
  process.exit(0);
}

async function uninstallLaunchd(): Promise<void> {
  const plist = launchdPlist();
  await run("launchctl", ["unload", plist]);
  await unlinkSafe(plist);
  console.log(`[wokroute] launchd agent removed: ${plist}`);
  process.exit(0);
}

function windowsStartupPath(): string {
  const appdata = Bun.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
  return join(appdata, "Microsoft/Windows/Start Menu/Programs/Startup/wokroute.cmd");
}

async function installWindows(): Promise<void> {
  const path = windowsStartupPath();
  // ponytail: .cmd batch wrapper instead of a .lnk shortcut — avoids COM /
  // Task Scheduler. Upgrade to .lnk when Windows shell-scripting deps land.
  const body = `@echo off\r\nstart "" /b "${EXEC}" run "${SCRIPT}"\r\n`;
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, body);
  console.log(`[wokroute] startup shortcut installed: ${path}`);
  console.log(`[wokroute] log out and back in to start on boot`);
  process.exit(0);
}

async function uninstallWindows(): Promise<void> {
  const path = windowsStartupPath();
  await unlinkSafe(path);
  console.log(`[wokroute] startup shortcut removed: ${path}`);
  process.exit(0);
}

async function installAutostart(): Promise<void> {
  switch (process.platform) {
    case "linux": return installSystemd();
    case "darwin": return installLaunchd();
    case "win32": return installWindows();
    default: console.error(`[wokroute] autostart unsupported on ${process.platform}`); process.exit(1);
  }
}

async function uninstallAutostart(): Promise<void> {
  switch (process.platform) {
    case "linux": return uninstallSystemd();
    case "darwin": return uninstallLaunchd();
    case "win32": return uninstallWindows();
    default: console.error(`[wokroute] autostart unsupported on ${process.platform}`); process.exit(1);
  }
}

// ── help ───────────────────────────────────────────────────────────────────

function printHelp(): void {
  console.log(`wokroute — self-hosted AI proxy

Usage:
  wokroute                 Run the server in the foreground
  wokroute -d, --daemon    Run in the background (writes a PID file)
  wokroute stop            Stop a background daemon
  wokroute install         Install boot autostart (systemd / launchd / Windows startup)
  wokroute uninstall       Remove boot autostart
  wokroute -h, --help      Show this help

Environment:
  PORT                     Server port (default 12800)
  DATA_DIR                 State directory (default ~/.local/share/wokroute)
  CONSOLE_PASSWORD         Console login password (default "wokroute" on first run)
  BOOTSTRAP_PROXY_API_KEY  Initial proxy API key

Console: http://localhost:<PORT>/console/login
`);
  process.exit(0);
}

// ── dispatch ───────────────────────────────────────────────────────────────

export async function dispatch(serverStarter: () => Promise<void>): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (cmd === "stop") return stopDaemon();
  if (cmd === "install") return installAutostart();
  if (cmd === "uninstall") return uninstallAutostart();
  if (cmd === "-h" || cmd === "--help") return printHelp();
  const daemon = argv.includes("-d") || argv.includes("--daemon");
  if (daemon) return spawnDaemon(argv);
  return serverStarter();
}
