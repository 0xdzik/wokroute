/** Overview page — KPI row, endpoint section, health panel, and API keys
 *  section stacked in a single flat column. Every metric lives in its own
 *  Card; nothing is nested inside another card. Data parsing lives in
 *  ./overview-data, key-limit logic in ./key-limits, queries in ./api. */

import { Activity, Database, Globe, TriangleAlert } from "lucide-react";
import { formatDuration } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { StatCard, StatePanel } from "../../components/ui/state";
import { ApiKeysSection } from "./api-keys-section";
import { useOverview, useUpdateInfo } from "./api";
import { EndpointSection } from "./endpoint-card";
import { HealthPanel } from "./health-panel";

/** Non-blocking update notice — hidden unless the backend confirms a newer
 *  npm version exists. Shares the layout header's query key, so the two
 *  surfaces never double-fetch. */
function UpdateBanner() {
  const { data } = useUpdateInfo();
  if (!data || !data.updateAvailable || !data.latest) return null;
  return (
    <section className="flex items-start gap-3 rounded-xl border border-[var(--orange)]/40 bg-[var(--orange-soft)] px-4 py-3">
      <TriangleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--status-warning)]" />
      <div className="min-w-0 text-[12.5px] leading-relaxed">
        <span className="font-semibold text-[var(--text-1)]">Update available: </span>
        <span className="text-[var(--text-2)]">
          v{data.latest} is out (current: v{data.current}). Run <code className="rounded bg-[var(--hover)] px-1 py-0.5 font-mono text-[11px]">wokroute update</code> or <code className="rounded bg-[var(--hover)] px-1 py-0.5 font-mono text-[11px]">npm i -g wokroute@latest</code> to upgrade.
        </span>
      </div>
    </section>
  );
}

export function OverviewPage() {
  const { data, isLoading, isError, refetch } = useOverview();

  if (isLoading) return <StatePanel kind="loading" title="Loading overview" description="Collecting runtime and provider health data…" />;
  if (isError || !data) return <StatePanel kind="error" title="Failed to load overview" description="The overview response was unavailable or invalid." action={<Button variant="secondary" onClick={() => refetch()}>Retry</Button>} />;

  const { totals } = data;
  const errorRate = totals.requests > 0 ? ((totals.errors / totals.requests) * 100).toFixed(1) : "0.0";
  const cacheRate = totals.inputTokens > 0 ? Math.round((totals.cachedTokens / totals.inputTokens) * 100) : 0;

  return (
    <div className="dashboard-page space-y-6">
      <UpdateBanner />
      {/* Traffic KPIs */}
      <section>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Latency" icon={Activity} tone="info" value={formatDuration(totals.avgDurationMs)} description="Avg duration" />
          <StatCard label="Cache" icon={Database} tone="accent" value={`${cacheRate}%`} description="Cache rate" />
          <StatCard label="Errors" icon={TriangleAlert} tone="danger" value={`${errorRate}%`} description="Error rate" />
          <StatCard label="Registry" icon={Globe} tone="success" value={data.registered.length} description="Providers" />
        </div>
      </section>

      <EndpointSection />
      <HealthPanel />
      <ApiKeysSection />
    </div>
  );
}
