/** "API Endpoint" section — two flat, independent cards (base URL and
 *  public IP). No card is nested inside another. */

import { useMemo } from "react";
import { Copy, Globe, MapPin } from "lucide-react";
import { toast } from "../../lib/toast";
import { copyText } from "../../lib/clipboard";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useIpAddresses } from "./api";

export function EndpointSection() {
  const baseUrl = useMemo(() => `${window.location.origin}/v1`, []);
  const currentHost = window.location.hostname || "local";
  const isLocalHost = currentHost === "localhost" || currentHost === "127.0.0.1" || currentHost === "::1";

  const ipQuery = useIpAddresses();
  const localIps = ipQuery.data?.ips ?? [];

  return (
    <section>
      <div className="mb-3 min-w-0">
        <h2 className="truncate text-[15px] font-bold tracking-tight">API Endpoint</h2>
        <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-3)]">Base URL for OpenAI- and Anthropic-compatible clients</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Base URL */}
        <Card>
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Globe size={16} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Local base URL</div>
              <code className="block truncate font-mono text-[12.5px] font-medium text-[var(--text-1)]" title={baseUrl}>{baseUrl}</code>
              <div className="mt-0.5 truncate text-[11px] text-[var(--text-3)]">OpenAI &amp; Anthropic compatible</div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => {
                void copyText(baseUrl).then((ok) => {
                  if (ok) toast.success("Copied");
                  else toast.error("Clipboard unavailable on this origin");
                });
              }}
            >
              <Copy size={13} /> Copy
            </Button>
          </div>
        </Card>
        {/* Public IP */}
        <Card>
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-muted)] text-[var(--status-info)]"><MapPin size={16} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Current public IP</div>
              <code className="block truncate font-mono text-[12.5px] font-medium text-[var(--text-1)]">{currentHost}</code>
              {localIps.length > 0 && <div className="mt-0.5 truncate text-[11px] text-[var(--text-3)]" title={localIps.join(", ")}>LAN: {localIps.join(" · ")}</div>}
            </div>
            <Badge tone={isLocalHost ? "default" : "info"} className="shrink-0">{isLocalHost ? "local" : "public"}</Badge>
          </div>
        </Card>
      </div>
    </section>
  );
}
