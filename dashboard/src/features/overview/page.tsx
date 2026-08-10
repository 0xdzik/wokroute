/** Overview page — KPI row, endpoint section, health panel, and API keys
 *  section stacked in a single flat column. Every metric lives in its own
 *  Card; nothing is nested inside another card. Data parsing lives in
 *  ./overview-data, key-limit logic in ./key-limits, queries in ./api. */

import { Activity, Database, Globe, TriangleAlert } from "lucide-react";
import { formatDuration } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { StatCard, StatePanel } from "../../components/ui/state";
import { ApiKeysSection } from "./api-keys-section";
import { useOverview } from "./api";
import { EndpointSection } from "./endpoint-card";
import { HealthPanel } from "./health-panel";

export function OverviewPage() {
  const { data, isLoading, isError, refetch } = useOverview();

  if (isLoading) return <StatePanel kind="loading" title="Loading overview" description="Collecting runtime and provider health data…" />;
  if (isError || !data) return <StatePanel kind="error" title="Failed to load overview" description="The overview response was unavailable or invalid." action={<Button variant="secondary" onClick={() => refetch()}>Retry</Button>} />;

  const { totals } = data;
  const errorRate = totals.requests > 0 ? ((totals.errors / totals.requests) * 100).toFixed(1) : "0.0";
  const cacheRate = totals.inputTokens > 0 ? Math.round((totals.cachedTokens / totals.inputTokens) * 100) : 0;

  return (
    <div className="dashboard-page space-y-6">
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
