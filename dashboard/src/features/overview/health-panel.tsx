/** "Health" section — one flat Card per metric (RAM, Warp, Network, CPU).
 *  Each metric is an independent card; nothing is nested inside another card. */

import { Cpu, Globe, MemoryStick, Network } from "lucide-react";
import { formatBandwidthKb, formatMemoryMb } from "../../lib/format";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { useHealthMetrics, useWarpMetricsSummary } from "./api";

function SectionHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-3 min-w-0">
      <h2 className="truncate text-[15px] font-bold tracking-tight">{title}</h2>
      <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-3)]">{sub}</p>
    </div>
  );
}

export function HealthPanel() {
  const healthQuery = useHealthMetrics();
  const warpMetricsQuery = useWarpMetricsSummary();

  const health = healthQuery.data;
  const cpuPercent = health ? Math.min(100, Math.max(0, health.cpuPercent)) : 0;
  const cpuTone = cpuPercent >= 80 ? "err" : cpuPercent >= 50 ? "warn" : "ok";
  const ramSystemPercent = health && health.memoryTotalMb > 0 ? Math.min(100, Math.max(0, (health.memorySystemUsedMb / health.memoryTotalMb) * 100)) : 0;

  return (
    <section>
      <SectionHeading title="Health" sub="Runtime resource usage · refreshes every 5s" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* RAM */}
        <Card>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--purple-soft)] text-[var(--purple)]"><MemoryStick size={15} /></span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[12.5px] font-bold tracking-tight">RAM usage</h3>
              <p className="truncate text-[11px] text-[var(--text-3)]">Bun Runtime · process</p>
            </div>
            <Badge tone="accent">{health ? `${formatMemoryMb(health.memorySystemUsedMb)} sys` : "—"}</Badge>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight tabular-nums">{health ? formatMemoryMb(health.memoryUsedMb) : "—"}</span>
            <span className="text-[11px] text-[var(--text-3)]">RSS</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--track)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={health ? ramSystemPercent : 0}>
            <div className="h-full origin-left rounded-full bg-[var(--purple)] transition-transform duration-500" style={{ transform: `scaleX(${ramSystemPercent / 100})` }} />
          </div>
          {health && (() => {
            const nativeMb = Math.max(0, health.memoryUsedMb - health.heapTotalMb - health.externalMb - health.arrayBuffersMb);
            const rss = health.memoryUsedMb;
            return (
              <div className="mt-3 space-y-2">
                {([
                  { label: "JS heap", used: health.heapUsedMb, bar: health.heapTotalMb, color: "var(--purple)" },
                  { label: "Bun runtime", used: nativeMb, bar: nativeMb, color: "var(--status-success)" },
                  { label: "External", used: health.externalMb, bar: health.externalMb, color: "var(--status-warning)" },
                  { label: "Array buffers", used: health.arrayBuffersMb, bar: health.arrayBuffersMb, color: "var(--status-info)" },
                ] as const).map(({ label, used, bar, color }) => (
                  <div key={label}>
                    <div className="mb-1 flex justify-between text-[11px] text-[var(--text-3)]">
                      <span>{label}</span>
                      <span className="tabular-nums">{formatMemoryMb(used)}</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-[var(--track)]">
                      <div className="h-full origin-left rounded-full transition-transform duration-500" style={{ transform: `scaleX(${Math.min(1, Math.max(0, rss === 0 ? 0 : bar / rss))})`, background: color }} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </Card>

        {/* Warp Proxy */}
        <Card>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--green-soft)] text-[var(--green)]"><Globe size={15} /></span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[12.5px] font-bold tracking-tight">Warp Proxy</h3>
              <p className="truncate text-[11px] text-[var(--text-3)]">MultiWarp pool</p>
            </div>
            <Badge tone={warpMetricsQuery.data?.runningCount ? "ok" : "default"}>{warpMetricsQuery.data ? "Live" : "—"}</Badge>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight tabular-nums">{warpMetricsQuery.data ? formatMemoryMb(warpMetricsQuery.data.totalRssMb) : "—"}</span>
            <span className="text-[11px] text-[var(--text-3)]">RSS</span>
          </div>
          <div className="mt-3 space-y-2">
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-[var(--text-3)]">
                <span>Healthy</span>
                <span className="tabular-nums">{warpMetricsQuery.data ? `${warpMetricsQuery.data.healthyCount}/${warpMetricsQuery.data.runningCount}` : "—"}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[var(--track)]">
                <div className="h-full origin-left rounded-full bg-[var(--status-success)] transition-transform duration-500" style={{ transform: `scaleX(${warpMetricsQuery.data && warpMetricsQuery.data.runningCount > 0 ? Math.min(1, warpMetricsQuery.data.healthyCount / warpMetricsQuery.data.runningCount) : 0})` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-[var(--text-3)]">
                <span>Bandwidth</span>
                <span className="tabular-nums">{warpMetricsQuery.data ? `${warpMetricsQuery.data.totalBandwidthMb} MB` : "—"}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[var(--track)]">
                <div className="h-full origin-left rounded-full bg-[var(--status-info)] transition-transform duration-500" style={{ transform: `scaleX(${warpMetricsQuery.data && warpMetricsQuery.data.totalBandwidthMb > 0 ? Math.min(1, warpMetricsQuery.data.totalBandwidthMb / 100) : 0})` }} />
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--text-3)]">Per-instance RSS summed across running wireproxy processes.</p>
        </Card>

        {/* Network */}
        <Card>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--teal-soft)] text-[var(--teal)]"><Network size={15} /></span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[12.5px] font-bold tracking-tight">Network</h3>
              <p className="truncate text-[11px] text-[var(--text-3)]">All interfaces</p>
            </div>
            <Badge tone={health?.netTotalKb !== null ? "info" : "default"}>{health?.netTotalKb !== null ? "Live" : "N/A"}</Badge>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold tracking-tight tabular-nums">{health ? formatBandwidthKb(health.netTotalKb) : "—"}</span>
              <span className="text-[11px] text-[var(--text-3)]">total</span>
            </div>
            <span className="text-[11px] tabular-nums text-[var(--text-2)]">{health?.netRateKbps != null ? `${health.netRateKbps.toLocaleString("en-US")} KB/s` : "—"}</span>
          </div>
          <div className="mt-3 space-y-2">
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-[var(--text-3)]">
                <span>Received</span>
                <span className="tabular-nums">{health ? formatBandwidthKb(health.netReceivedKb) : "—"}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[var(--track)]">
                <div className="h-full origin-left rounded-full bg-[var(--status-info)] transition-transform duration-500" style={{ transform: `scaleX(${health && health.netTotalKb && health.netReceivedKb ? Math.min(1, health.netReceivedKb / health.netTotalKb) : 0})` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-[var(--text-3)]">
                <span>Sent</span>
                <span className="tabular-nums">{health ? formatBandwidthKb(health.netSentKb) : "—"}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[var(--track)]">
                <div className="h-full origin-left rounded-full bg-[var(--status-success)] transition-transform duration-500" style={{ transform: `scaleX(${health && health.netTotalKb && health.netSentKb ? Math.min(1, health.netSentKb / health.netTotalKb) : 0})` }} />
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--text-3)]">Cumulative I/O since boot · rate sampled every 5s.</p>
        </Card>

        {/* CPU */}
        <Card>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--orange-soft)] text-[var(--orange)]"><Cpu size={15} /></span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[12.5px] font-bold tracking-tight">CPU usage</h3>
              <p className="truncate text-[11px] text-[var(--text-3)]">Process load</p>
            </div>
            <Badge tone={cpuTone}>{health ? "Live" : "Waiting"}</Badge>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <div className="relative grid size-[76px] shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${cpuTone === "err" ? "var(--status-danger)" : cpuTone === "warn" ? "var(--status-warning)" : "var(--accent)"} ${cpuPercent}%, var(--track) 0)` }} role="img" aria-label={health ? `CPU usage ${cpuPercent.toFixed(1)} percent` : "CPU usage unavailable"}>
              <div className="grid size-[58px] place-items-center rounded-full bg-[var(--surface-1)]">
                <span className="text-[15px] font-bold tabular-nums">{health ? `${cpuPercent.toFixed(1)}%` : "—"}</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-[var(--text-3)]">Cores</span>
                <span className="font-semibold tabular-nums">{health ? `${health.coreCount} logical` : "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-[var(--text-3)]">PID</span>
                <span className="max-w-[8rem] truncate font-mono font-semibold">{health ? String(health.pid) : "—"}</span>
              </div>
            </div>
          </div>
          {health && <p className="mt-3 truncate text-[11px] text-[var(--text-3)]" title={health.cpuModel}>{health.cpuModel}</p>}
        </Card>
      </div>
    </section>
  );
}
