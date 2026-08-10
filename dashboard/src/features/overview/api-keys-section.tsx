/** API Keys section — require-key switch, key list, and create/edit/reveal
 *  dialogs. All key form state lives here so typing in the dialogs never
 *  re-renders the KPI row or health panel above. */

import { Copy, KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { formatTime, formatTokens } from "../../lib/format";
import { staggerClass } from "../../lib/motion";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Switch } from "../../components/ui/switch";
import { ConfirmDialog } from "../../components/shared";
import { useProviders } from "../../components/model-picker";
import {
  useApiKeys,
  useAuthModeMutation,
  useCopyCredentialMutation,
  useCreateKeyMutation,
  useDeleteKeyMutation,
  useEditKeyMutation,
  useRegenerateKeyMutation,
  useRevokeKeyMutation,
  useRuntimeSettings,
} from "./api";
import { buildKeyLimitsInput, formatKeyLimits } from "./key-limits";
import { CreateKeyDialog, EditKeyDialog, RevealedKeyDialog, type KeyLimitsFormProps } from "./key-dialogs";
import type { ApiKeyRecord, CreatedKey, TokenBudgetMode } from "./types";

export function ApiKeysSection() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiKeyRecord | null>(null);
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [rpm, setRpm] = useState("");
  const [daily, setDaily] = useState("");
  const [monthly, setMonthly] = useState("");
  const [oneTime, setOneTime] = useState("");
  const [budgetMode, setBudgetMode] = useState<TokenBudgetMode>("recurring");
  const [concurrent, setConcurrent] = useState("");
  const [allowed, setAllowed] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<CreatedKey | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRecord | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<ApiKeyRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyRecord | null>(null);

  const resetKeyForm = () => {
    setName("");
    setPrefix("");
    setCustomKey("");
    setRpm("");
    setDaily("");
    setMonthly("");
    setOneTime("");
    setBudgetMode("recurring");
    setConcurrent("");
    setAllowed([]);
  };

  const openEdit = (key: ApiKeyRecord) => {
    setEditTarget(key);
    setRpm(key.rateLimitRpm ? String(key.rateLimitRpm) : "");
    const hasOneTimeBudget = key.oneTimeTokenLimit !== null;
    setBudgetMode(hasOneTimeBudget ? "one-time" : "recurring");
    setDaily(key.dailyTokenLimit ? String(key.dailyTokenLimit) : "");
    setMonthly(key.monthlyTokenLimit ? String(key.monthlyTokenLimit) : "");
    setOneTime(key.oneTimeTokenLimit ? String(key.oneTimeTokenLimit) : "");
    setConcurrent(key.maxConcurrentRequests ? String(key.maxConcurrentRequests) : "");
    setAllowed([...(key.providerAllowlist ?? []), ...(key.modelAllowlist ?? [])]);
  };

  const closeEdit = () => {
    setEditTarget(null);
    resetKeyForm();
  };

  const settingsQuery = useRuntimeSettings();
  const keysQuery = useApiKeys();

  const providersQuery = useProviders();
  const providerIds = useMemo(() => new Set((providersQuery.data?.items ?? []).map((p) => p.id)), [providersQuery.data]);

  const authModeMutation = useAuthModeMutation();

  const createMutation = useCreateKeyMutation();
  const editMutation = useEditKeyMutation();
  const regenerateMutation = useRegenerateKeyMutation();
  const revokeMutation = useRevokeKeyMutation();
  const deleteMutation = useDeleteKeyMutation();
  const credentialCopy = useCopyCredentialMutation();

  const submitCreate = () => {
    createMutation.mutate(
      {
        name: name.trim(),
        prefix: prefix.trim() || undefined,
        key: customKey.trim() || undefined,
        ...buildKeyLimitsInput(rpm, daily, monthly, concurrent, allowed, providerIds, oneTime, budgetMode),
      },
      {
        onSuccess: (created) => {
          setRevealed(created);
          setCreateOpen(false);
          resetKeyForm();
        },
      },
    );
  };

  const submitEdit = () => {
    if (!editTarget) return;
    const limits = buildKeyLimitsInput(rpm, daily, monthly, concurrent, allowed, providerIds, oneTime, budgetMode);
    editMutation.mutate(
      {
        id: editTarget.id,
        patch: {
          ...(customKey.trim() ? { key: customKey.trim() } : {}),
          rateLimitRpm: limits.rateLimitRpm ?? null,
          dailyTokenLimit: limits.dailyTokenLimit ?? null,
          monthlyTokenLimit: limits.monthlyTokenLimit ?? null,
          oneTimeTokenLimit: limits.oneTimeTokenLimit ?? null,
          maxConcurrentRequests: limits.maxConcurrentRequests ?? null,
          providerAllowlist: limits.providerAllowlist ?? null,
          modelAllowlist: limits.modelAllowlist ?? null,
        },
      },
      { onSuccess: closeEdit },
    );
  };

  const runtime = settingsQuery.data?.settings.runtime;
  const requireKey = runtime?.proxyAuthMode === "api_key";
  const keys = keysQuery.data?.items ?? [];

  const onBudgetModeChange = (mode: TokenBudgetMode) => {
    setBudgetMode(mode);
    if (mode === "one-time") {
      setDaily("");
      setMonthly("");
    } else {
      setOneTime("");
    }
  };

  const limitsForm: KeyLimitsFormProps = {
    rpm,
    daily,
    monthly,
    oneTime,
    budgetMode,
    concurrent,
    allowed,
    setRpm,
    setDaily,
    setMonthly,
    setOneTime,
    setConcurrent,
    setAllowed,
    onBudgetModeChange,
  };

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-bold tracking-tight">API Keys</h2>
          <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-3)]">Client keys for proxy access</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> New key
        </Button>
      </div>
      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <div className="text-[13px] font-semibold">Require API key</div>
            <div className="mt-0.5 text-[11px] text-[var(--text-3)]">Requests without a valid key will be rejected</div>
          </div>
          <Switch
            checked={requireKey}
            label="Require API key"
            disabled={!runtime || authModeMutation.isPending}
            onChange={(on) => authModeMutation.mutate(on ? "api_key" : "open")}
          />
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {keysQuery.isLoading ? (
            <div className="px-4 py-10 text-center text-xs text-[var(--text-3)]">Loading API keys…</div>
          ) : keys.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-[var(--text-3)]">No keys yet — create one to enforce proxy authentication.</div>
          ) : (
            keys.map((key, index) => (
              <article key={key.id} {...staggerClass(index)} className="py-4 first:pt-4 last:pb-0">
                {/* Identity + actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-bold">{key.name}</h3>
                  <Badge tone={key.active ? "ok" : "default"}>{key.revokedAt ? "revoked" : key.active ? "active" : "disabled"}</Badge>
                  <code className="truncate font-mono text-[11px] text-[var(--text-3)]">{key.keyPrefix}…</code>
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    {key.active && (
                      <Button variant="ghost" size="sm" disabled={credentialCopy.isPending} onClick={() => credentialCopy.mutate(key.id)} title="Copy API key" aria-label={`Copy API key ${key.name}`}><Copy size={13} /> Copy</Button>
                    )}
                    <Button variant="ghost" size="sm" disabled={editMutation.isPending || Boolean(key.revokedAt)} onClick={() => editMutation.mutate({ id: key.id, patch: { active: !key.active } }, { onSuccess: closeEdit })} title={key.active ? "Disable API key" : "Enable API key"}>
                      {key.active ? "Disable" : "Enable"}
                    </Button>
                    {key.active && <Button variant="ghost" size="sm" disabled={regenerateMutation.isPending} onClick={() => setRegenerateTarget(key)} title="Rotate API key"><KeyRound size={13} /> Rotate</Button>}
                    <Button variant="ghost" size="sm" onClick={() => openEdit(key)} title="Edit key status, limits and ACL"><Pencil size={13} /> Edit</Button>
                    {key.revokedAt ? <Button variant="ghost" size="sm" className="text-[var(--red)]" onClick={() => setDeleteTarget(key)}><Trash2 size={13} /> Delete</Button> : null}
                  </div>
                </div>
                {/* Flat stat strip — no nested boxes */}
                <div className="mt-2.5 flex flex-wrap gap-x-7 gap-y-1.5 text-[11px]">
                  <span className="min-w-0">
                    <span className="font-semibold uppercase tracking-wide text-[var(--text-3)]">Limits</span>
                    <span className="mt-0.5 block max-w-56 truncate text-[var(--text-2)]" title={formatKeyLimits(key)}>{formatKeyLimits(key)}</span>
                  </span>
                  <span>
                    <span className="font-semibold uppercase tracking-wide text-[var(--text-3)]">Today</span>
                    <span className="mt-0.5 block font-semibold tabular-nums text-[var(--text-1)]">{formatTokens(key.todayTokens)}</span>
                  </span>
                  <span>
                    <span className="font-semibold uppercase tracking-wide text-[var(--text-3)]">Total</span>
                    <span className="mt-0.5 block font-semibold tabular-nums text-[var(--text-1)]">{formatTokens(key.totalTokens)}</span>
                  </span>
                  <span>
                    <span className="font-semibold uppercase tracking-wide text-[var(--text-3)]">Last used</span>
                    <span className="mt-0.5 block tabular-nums text-[var(--text-2)]">{formatTime(key.lastUsedAt)}</span>
                  </span>
                  <span>
                    <span className="font-semibold uppercase tracking-wide text-[var(--text-3)]">Created</span>
                    <span className="mt-0.5 block tabular-nums text-[var(--text-2)]">{formatTime(key.createdAt)}</span>
                  </span>
                </div>
              </article>
            ))
          )}
        </div>
      </Card>

      <CreateKeyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        name={name}
        setName={setName}
        prefix={prefix}
        setPrefix={setPrefix}
        customKey={customKey}
        setCustomKey={setCustomKey}
        limits={limitsForm}
        busy={createMutation.isPending}
        onCreate={submitCreate}
      />

      <EditKeyDialog
        targetName={editTarget?.name ?? null}
        onClose={closeEdit}
        customKey={customKey}
        setCustomKey={setCustomKey}
        limits={limitsForm}
        busy={editMutation.isPending}
        onSave={submitEdit}
      />

      <RevealedKeyDialog revealed={revealed} onClose={() => setRevealed(null)} />

      <ConfirmDialog open={!!revokeTarget} onClose={() => setRevokeTarget(null)} onConfirm={() => revokeTarget && revokeMutation.mutate(revokeTarget.id, { onSuccess: () => { setRevokeTarget(null); closeEdit(); } })} title="Revoke API Key" message={`Revoke "${revokeTarget?.name}"? This cannot be undone.`} danger confirmLabel="Revoke" />
      <ConfirmDialog open={!!regenerateTarget} onClose={() => setRegenerateTarget(null)} onConfirm={() => regenerateTarget && regenerateMutation.mutate(regenerateTarget.id, { onSuccess: (created) => { setRegenerateTarget(null); setRevealed(created); closeEdit(); } })} title="Revoke & regenerate API Key" message={`The current credential for "${regenerateTarget?.name}" will stop working immediately and a new key will be shown once. Continue?`} danger confirmLabel="Revoke & regenerate" />
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })} title="Delete API Key" message={`Permanently delete "${deleteTarget?.name}"? This removes the key from the database entirely.`} danger confirmLabel="Delete" />
    </section>
  );
}
