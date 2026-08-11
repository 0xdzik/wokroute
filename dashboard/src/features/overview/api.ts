/** API hooks for the Overview feature — queries + key/settings mutations.
 *  Query keys, payloads, toasts, and invalidations match the previous
 *  inline implementation exactly (moved, not changed). */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "../../lib/toast";
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from "../../lib/api";
import { copyText } from "../../lib/clipboard";
import { qk } from "../../lib/query-keys";
import { parseOverviewData } from "./overview-data";
import type { ApiKeyRecord, CreatedKey, HealthMetrics, KeyLimitsInput, KeyUpdatePatch, RuntimeSettings, SettingsResponse, UpdateInfo, WarpMetricsSummary } from "./types";

// ── Queries ────────────────────────────────────────────────────────────────

export function useOverview() {
  return useQuery({
    queryKey: qk.overview.all,
    queryFn: async () => {
      const response = await apiGet<unknown>("/overview");
      const parsed = parseOverviewData(response);
      if (parsed === null) throw new Error("Invalid overview response");
      return parsed;
    },
  });
}

export function useIpAddresses() {
  return useQuery({ queryKey: qk.ip.all, queryFn: () => apiGet<{ ips: string[] }>("/ip"), staleTime: 60_000 });
}

export function useRuntimeSettings() {
  return useQuery({
    queryKey: qk.settings.all,
    queryFn: () => apiGet<SettingsResponse>("/settings"),
  });
}

export function useApiKeys() {
  return useQuery({
    queryKey: qk.apiKeys.all,
    queryFn: () => apiGet<{ items: ApiKeyRecord[] }>("/keys"),
  });
}

export function useHealthMetrics() {
  return useQuery({
    queryKey: qk.health.metrics,
    queryFn: () => apiGet<HealthMetrics>("/health/metrics"),
    refetchInterval: 5_000,
  });
}

export function useWarpMetricsSummary() {
  return useQuery({
    queryKey: qk.warp.metricsSummary,
    queryFn: () => apiGet<WarpMetricsSummary>("/warp/metrics/summary"),
    refetchInterval: 5_000,
  });
}

export function useUpdateInfo() {
  return useQuery({
    queryKey: qk.releases.updateInfo,
    queryFn: () => apiGet<UpdateInfo>("/health/update"),
    // Every Overview mount re-checks logically; the backend TTL-caches the
    // registry hit, and this staleTime keeps remounts from refetching.
    staleTime: 5 * 60_000,
    retry: false,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

export function useAuthModeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proxyAuthMode: RuntimeSettings["proxyAuthMode"]) =>
      apiPost<{ ok: boolean }>("/settings", { proxyAuthMode }),
    onSuccess: (_res, proxyAuthMode) => {
      toast.success(proxyAuthMode === "api_key" ? "API key now required" : "Proxy access is open");
      void queryClient.invalidateQueries({ queryKey: qk.settings.all });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "failed to update proxy access"),
  });
}

export function useCreateKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; prefix?: string } & KeyLimitsInput) => apiPost<CreatedKey>("/keys", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.apiKeys.all });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "failed to create key"),
  });
}

export function useEditKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; patch: KeyUpdatePatch }) => apiPatch<ApiKeyRecord>(`/keys/${input.id}`, input.patch),
    onSuccess: () => {
      toast.success("Key updated");
      void queryClient.invalidateQueries({ queryKey: qk.apiKeys.all });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "failed to update key"),
  });
}

export function useRegenerateKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<CreatedKey>(`/keys/${id}/regenerate`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.apiKeys.all });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "failed to regenerate key"),
  });
}

export function useRevokeKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<{ ok: boolean }>(`/keys/${id}/revoke`, {}),
    onSuccess: () => {
      toast.success("Key revoked");
      void queryClient.invalidateQueries({ queryKey: qk.apiKeys.all });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "failed to revoke key"),
  });
}

export function useDeleteKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/keys/${id}`),
    onSuccess: () => {
      toast.success("Key deleted permanently");
      void queryClient.invalidateQueries({ queryKey: qk.apiKeys.all });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "failed to delete key"),
  });
}

export function useCopyCredentialMutation() {
  return useMutation({
    mutationFn: async (keyId: string) => {
      const { key } = await apiGet<{ key: string }>(`/keys/${keyId}/credential`);
      const ok = await copyText(key);
      if (!ok) throw new Error("Clipboard unavailable on this origin");
    },
    onSuccess: () => toast.success("Copied API key to clipboard"),
    onError: (err) => toast.error(err instanceof Error ? err.message : "failed to copy key"),
  });
}
