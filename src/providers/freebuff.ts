import {
  AbortCoordinator,
  ProviderAdapterError,
  capabilitiesOf,
  createModelCatalog,
  executeFetch,
  isRecord,
  lineLimit,
  mapSseStream,
  modelOf,
  readJsonObject,
  readUpstreamError,
  toProviderCallError,
} from "./shared";
import { createChatMapper } from "../transport/protocols/openai";
import { buildChatPayload, mapChatUsage } from "../domain/protocols/openai-chat";
import { extractAccessTokenOrRaw } from "../auth/credential-bundle";
import type {
  ContextStats,
  NetworkSelection,
  ProviderAdapter,
  ProviderCapabilities,
  ProviderMetadata,
  ProviderModel,
  ProviderModelCatalog,
  ProviderOutput,
  ProviderRequest,
  ProviderSurface,
  RouteTarget,
  TokenCountInput,
} from "../domain/contracts";
import type { ProviderCallError } from "../domain/contracts";

/**
 * Freebuff — the free, ad-supported coding agent by Codebuff (freebuff.com).
 *
 * The Freebuff CLI talks to the Codebuff/Freebuff backend. Two hosts:
 *   - login flow runs on https://freebuff.com (handled by FreebuffOAuthDriver)
 *   - LLM traffic goes to https://www.codebuff.com/api/v1/chat/completions
 *
 * Wire shape mirrors the official CLI: `codebuff_metadata` and `provider` are
 * spread at the TOP LEVEL of the request body (NOT nested under a `codebuff`
 * object — the backend rejects the nested shape with 400 "No runId found").
 *
 * Every chat request first registers a run via POST /api/v1/agent-runs →
 * { runId }, and the free tier additionally gates on a session: POST
 * /api/v1/freebuff/session claims a row (bound to one model, ~1h). The run_id
 * and freebuff_instance_id ride in codebuff_metadata.
 *
 * The free tier rejects requests whose first system message doesn't open with
 * the canonical Freebuff CLI root prompt (server gate → 403
 * free_mode_cli_required), so we prepend the canonical opening.
 */

const FREEBUFF_SURFACES: readonly ProviderSurface[] = ["openai-chat"];
const FREEBUFF_CHAT_URL = "https://www.codebuff.com/api/v1/chat/completions";
const FREEBUFF_SESSION_URL = "https://www.codebuff.com/api/v1/freebuff/session";
const FREEBUFF_RUN_URL = "https://www.codebuff.com/api/v1/agent-runs";
const FREEBUFF_ORIGIN = "https://www.codebuff.com";
const FREEBUFF_USER_AGENT = "codebuff-cli/0.0.138";
const SESSION_DEFAULT_TTL_MS = 60 * 60 * 1000;
const SESSION_HTTP_TIMEOUT_MS = 15_000;

// Chat statuses that mean our claimed session is stale and must be re-claimed
// before retrying (mirrors the CLI's FreebuffGateErrorKind statuses).
const SESSION_STALE_CODES = new Set([428, 409, 410]);

// The free tier rejects requests whose first system message doesn't open with
// the canonical Freebuff CLI root prompt (server gate → 403
// free_mode_cli_required). Byte-exact prefix test on position 0.
const FREEBUFF_SYSTEM_MARKER = "You are Buffy, the strategic coding assistant.";
const FREEBUFF_ROOT_SYSTEM_OPENINGS = [
  "You are Buffy, the strategic coding assistant.",
  "You are Buffy, the Freebuff Cloud project planner.",
  "You are Buffy, a strategic assistant that orchestrates complex coding tasks through specialized sub-agents.",
];

// Freebuff root agent id per model (mirrors the CLI's FREEBUFF_ROOT_AGENT_ID_BY_MODEL).
const FREE_ROOT_AGENT_BY_MODEL: Record<string, string> = {
  "deepseek/deepseek-v4-flash": "base2-free-deepseek-flash",
  "deepseek/deepseek-v4-pro": "base2-free-deepseek",
  "mimo/mimo-v2.5": "base2-free-mimo",
  "minimax/minimax-m3": "base2-free-minimax-m3",
  "openai/gpt-5.6-luna": "base2-free-luna",
};

const GATE_MESSAGES: Record<string, string> = {
  country_blocked: "Freebuff is not available in your region (country blocked).",
  banned: "Your Freebuff account has been banned.",
  ip_capped: "Freebuff IP cap reached — try again later.",
  rate_limited: "Freebuff session limit reached for this model — try again later.",
  spend_limited: "Freebuff spend limit reached — add credits or wait for the window to reset.",
  model_locked: "Freebuff session is locked to another model — end it in the CLI or wait for it to expire.",
  model_unavailable: "This model is not available on Freebuff right now.",
  premium_slot_taken: "Freebuff premium slot is taken — try another model.",
};

const FREEBUFF_MODELS: readonly ProviderModel[] = [
  modelOf("deepseek/deepseek-v4-flash", "DeepSeek V4 Flash", capabilitiesOf({ surfaces: FREEBUFF_SURFACES, reasoning: true })),
  modelOf("deepseek/deepseek-v4-pro", "DeepSeek V4 Pro", capabilitiesOf({ surfaces: FREEBUFF_SURFACES, reasoning: true })),
  modelOf("mimo/mimo-v2.5", "MiMo 2.5", capabilitiesOf({ surfaces: FREEBUFF_SURFACES, reasoning: true })),
  modelOf("minimax/minimax-m3", "MiniMax M3", capabilitiesOf({ surfaces: FREEBUFF_SURFACES, reasoning: true })),
  modelOf("openai/gpt-5.6-luna", "GPT 5.6 Luna", capabilitiesOf({ surfaces: FREEBUFF_SURFACES, reasoning: true })),
];

const FREEBUFF_FALLBACK_CAPABILITIES: ProviderCapabilities = capabilitiesOf({ surfaces: FREEBUFF_SURFACES, reasoning: true });

// ────────────────────────── session / run helpers ──────────────────────────

interface SessionEntry {
  readonly instanceId: string | null;
  readonly expiresAt: number;
}

// Per-token+model session cache (in-memory; keyed so multi-account setups
// don't share one session row). Re-claims are driven by the cache expiring or
// by a 428 from chat — no early re-claim.
const sessionCache = new Map<string, SessionEntry>();

function sessionCacheKey(token: string, model: string): string {
  return `${token}::${model}`;
}

function rootAgentIdForModel(model: string): string {
  return FREE_ROOT_AGENT_BY_MODEL[model] ?? "base2-free";
}

// Ensure messages[0] opens with a canonical Freebuff root prompt (idempotent).
function injectFreebuffMarker(payload: Record<string, unknown>): Record<string, unknown> {
  const messages = payload.messages;
  if (!Array.isArray(messages) || messages.length === 0) return payload;
  const first = messages[0];
  if (isRecord(first) && first.role === "system" && typeof first.content === "string") {
    const trimmed = first.content.trimStart();
    if (FREEBUFF_ROOT_SYSTEM_OPENINGS.some((opening) => trimmed.startsWith(opening))) return payload;
    return {
      ...payload,
      messages: [{ ...first, content: `${FREEBUFF_SYSTEM_MARKER}\n\n${first.content}` }, ...messages.slice(1)],
    };
  }
  return { ...payload, messages: [{ role: "system", content: FREEBUFF_SYSTEM_MARKER }, ...messages] };
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text().catch(() => "");
  try {
    return text.length > 0 ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

/** Claims a session via POST /api/v1/freebuff/session with x-freebuff-model header. */
async function requestSession(token: string, model: string, network: NetworkSelection | undefined): Promise<{ instanceId: string | null; status: string }> {
  const coordinator = new AbortCoordinator(AbortSignal.timeout(SESSION_HTTP_TIMEOUT_MS), { connectTimeoutMs: SESSION_HTTP_TIMEOUT_MS });
  try {
    const response = await executeFetch(FREEBUFF_SESSION_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "user-agent": FREEBUFF_USER_AGENT,
        "x-freebuff-model": model,
      },
    }, coordinator, network);

    if (response.status === 401) {
      throw new ProviderAdapterError({ kind: "authentication_failed", message: "Freebuff session auth failed (401) — re-login in the dashboard.", statusCode: 401, routeScope: "account" });
    }

    const data = await readJsonResponse(response);

    if (!response.ok) {
      const status = typeof data.status === "string" ? data.status : String(response.status);
      if (GATE_MESSAGES[status] !== undefined) {
      throw new ProviderAdapterError({ kind: "quota_exceeded", message: GATE_MESSAGES[status], statusCode: response.status, routeScope: "account" });
      }
      throw new ProviderAdapterError({ kind: "provider_unavailable", message: `Freebuff session request failed: ${response.status}`, statusCode: response.status, routeScope: "provider" });
    }

    const status = typeof data.status === "string" ? data.status : "";
    if (status === "active") {
      const instanceId = typeof data.instanceId === "string" ? data.instanceId : null;
      const parsedExp = Date.parse(typeof data.expiresAt === "string" ? data.expiresAt : "");
      const expiresAt = Number.isFinite(parsedExp) ? parsedExp : Date.now() + SESSION_DEFAULT_TTL_MS;
      sessionCache.set(sessionCacheKey(token, model), { instanceId, expiresAt });
      return { instanceId, status: "active" };
    }
    if (status === "none") {
      return { instanceId: null, status: "none" };
    }
    if (GATE_MESSAGES[status] !== undefined) {
    throw new ProviderAdapterError({ kind: "quota_exceeded", message: GATE_MESSAGES[status], statusCode: response.status, routeScope: "account" });
    }
    throw new ProviderAdapterError({ kind: "provider_unavailable", message: `Freebuff session rejected (${status || response.status})`, statusCode: response.status, routeScope: "provider" });
  } finally {
    coordinator.dispose();
  }
}

async function ensureSession(token: string, model: string, network: NetworkSelection | undefined, force = false): Promise<{ instanceId: string | null; status: string }> {
  const key = sessionCacheKey(token, model);
  if (!force) {
    const cached = sessionCache.get(key);
    if (cached !== undefined && cached.expiresAt > Date.now()) {
      return { instanceId: cached.instanceId, status: "active" };
    }
  } else {
    sessionCache.delete(key);
  }
  return requestSession(token, model, network);
}

/** Registers an agent run so the chat backend can resolve the run_id we send. */
async function startRun(token: string, model: string, network: NetworkSelection | undefined): Promise<string> {
  const coordinator = new AbortCoordinator(AbortSignal.timeout(SESSION_HTTP_TIMEOUT_MS), { connectTimeoutMs: SESSION_HTTP_TIMEOUT_MS });
  try {
    const response = await executeFetch(FREEBUFF_RUN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "user-agent": FREEBUFF_USER_AGENT,
      },
      body: JSON.stringify({
        action: "START",
        agentId: rootAgentIdForModel(model),
        ancestorRunIds: [],
      }),
    }, coordinator, network);

    if (response.status === 401) {
      throw new ProviderAdapterError({ kind: "authentication_failed", message: "Freebuff run auth failed (401) — re-login in the dashboard.", statusCode: 401, routeScope: "account" });
    }

    const data = await readJsonResponse(response);
    if (!response.ok) {
      throw new ProviderAdapterError({ kind: "provider_unavailable", message: `Freebuff run start failed: ${response.status}`, statusCode: response.status, routeScope: "provider" });
    }
    const runId = typeof data.runId === "string" ? data.runId : null;
    if (runId === null) {
      throw new ProviderAdapterError({ kind: "provider_protocol_error", message: "Freebuff run start returned no runId.", routeScope: "provider" });
    }
    return runId;
  } finally {
    coordinator.dispose();
  }
}

/** Best-effort run completion — never throws (server sweeps stale runs). */
async function finishRun(token: string, runId: string, status: string, network: NetworkSelection | undefined): Promise<void> {
  const coordinator = new AbortCoordinator(AbortSignal.timeout(10_000), { connectTimeoutMs: 10_000 });
  try {
    await executeFetch(FREEBUFF_RUN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "user-agent": FREEBUFF_USER_AGENT,
      },
      body: JSON.stringify({ action: "FINISH", runId, status }),
    }, coordinator, network);
  } catch {
    // Best-effort only.
  } finally {
    coordinator.dispose();
  }
}

// ────────────────────────────── adapter ─────────────────────────────────────

export class FreebuffAdapter implements ProviderAdapter {
  readonly metadata: ProviderMetadata = {
    id: "freebuff",
    displayName: "Freebuff",
    protocol: "openai",
    credentialKind: "oauth",
  };
  readonly models: ProviderModelCatalog = createModelCatalog(FREEBUFF_MODELS);
  readonly capabilities: ProviderCapabilities = { ...FREEBUFF_FALLBACK_CAPABILITIES, streaming: true };

  resolveTarget(modelId: string, surface: ProviderSurface): RouteTarget {
    if (!this.capabilities.surfaces.includes(surface)) {
      throw new ProviderAdapterError({ kind: "capability_unsupported", message: `Provider "${this.metadata.id}" does not support surface "${surface}"`, statusCode: 400, routeScope: null });
    }
    if (this.models.get(modelId) === null) {
      throw new ProviderAdapterError({ kind: "model_not_found", message: `Model "${modelId}" is not in the "${this.metadata.id}" catalog`, statusCode: 404, routeScope: "provider" });
    }
    const entry = this.models.get(modelId);
    return { providerId: this.metadata.id, modelId, upstreamModelId: entry?.upstreamId ?? modelId, surface };
  }

  async call(input: ProviderRequest): Promise<ProviderOutput> {
    if (input.target.surface !== "openai-chat") {
      throw new ProviderAdapterError({ kind: "capability_unsupported", message: `Provider "${this.metadata.id}" does not support surface "${input.target.surface}"`, statusCode: 400, routeScope: null });
    }
    const token = extractAccessTokenOrRaw(input.credential);
    if (token.length === 0) {
      throw new ProviderAdapterError({ kind: "authentication_failed", message: "A Freebuff OAuth access token is required.", statusCode: 401, routeScope: "account" });
    }

    const { request, signal, network } = input;
    const model = input.target.upstreamModelId;
    const clientId = `9router-${crypto.randomUUID()}`;
    const traceSessionId = crypto.randomUUID();

    // Claim a session for this token+model.
    let session = await ensureSession(token, model, network);

    // The run currently in flight. Only this one is FINISH-able: after a stale
    // session (428/409/410) the old run is FINISH'd "cancelled" and cleared.
    let activeRunId: string | null = null;
    const markFinished = (status: string): void => {
      if (activeRunId === null) return;
      const id = activeRunId;
      activeRunId = null;
      void finishRun(token, id, status, network);
    };

    try {
      // Register a run whose id the backend resolves on chat.
      activeRunId = await startRun(token, model, network);

      let result = await this.doChat(input, token, model, activeRunId, clientId, traceSessionId, session, signal, network);

      // Session gates: 428 (waiting_room_required), 409 (session_superseded /
      // session_model_mismatch), 410 (session_expired). Re-claim + retry once.
      if (SESSION_STALE_CODES.has(result.response.status)) {
        markFinished("cancelled");
        session = await ensureSession(token, model, network, true);
        activeRunId = await startRun(token, model, network);
        result = await this.doChat(input, token, model, activeRunId, clientId, traceSessionId, session, signal, network);

        if (SESSION_STALE_CODES.has(result.response.status)) {
          throw await readUpstreamError(result.response);
        }
      }

      // 401: drop the cached session so a re-login starts clean.
      if (result.response.status === 401) {
        sessionCache.delete(sessionCacheKey(token, model));
        throw await readUpstreamError(result.response);
      }

      if (!result.response.ok) {
        markFinished("failed");
        throw await readUpstreamError(result.response);
      }

      markFinished("completed");
      return result.output;
    } finally {
      if (activeRunId !== null) {
        void finishRun(token, activeRunId, "failed", network);
      }
    }
  }

  /** Sends the chat POST and returns the response + decoded output. */
  private async doChat(
    input: ProviderRequest,
    token: string,
    model: string,
    runId: string,
    clientId: string,
    traceSessionId: string,
    session: { instanceId: string | null; status: string },
    signal: AbortSignal,
    network: NetworkSelection,
  ): Promise<{ response: Response; output: ProviderOutput }> {
    const { request } = input;
    const payload = injectFreebuffMarker(buildChatPayload(request));
    payload.model = model;
    // Top-level codebuff_metadata — NOT nested under `codebuff` (backend rejects nested).
    const metadata: Record<string, unknown> = {
      run_id: runId,
      client_id: clientId,
      cost_mode: "free",
      trace_session_id: traceSessionId,
    };
    if (session.instanceId !== null) metadata.freebuff_instance_id = session.instanceId;
    payload.codebuff_metadata = metadata;
    payload.provider = { allow_fallbacks: false };

    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: request.stream ? "text/event-stream" : "application/json",
      authorization: `Bearer ${token}`,
      "user-agent": FREEBUFF_USER_AGENT,
    };

    const coordinator = new AbortCoordinator(signal, {
      connectTimeoutMs: request.limits.connectTimeoutMs,
      totalTimeoutMs: request.limits.totalTimeoutMs,
    });
    let streamHandedOff = false;
    try {
      const response = await executeFetch(FREEBUFF_CHAT_URL, { method: "POST", headers, body: JSON.stringify(payload) }, coordinator, network);

      // If not ok, return the response for the caller to handle (retry/throw).
      if (!response.ok) {
        return { response, output: { mode: "non_stream", body: {} } };
      }

      if (!request.stream) {
        const body = await readJsonObject(response, coordinator);
        const usageRecord = isRecord(body.usage) ? body.usage : null;
        return { response, output: { mode: "non_stream", body, usage: usageRecord !== null ? mapChatUsage(usageRecord) : undefined } };
      }

      if (!response.body) {
        throw new ProviderAdapterError({ kind: "provider_protocol_error", message: "Freebuff returned an empty stream body", routeScope: "provider" });
      }
      streamHandedOff = true;
      const events = mapSseStream(
        { body: response.body, coordinator, maxLineBytes: lineLimit(request.limits), idleTimeoutMs: request.limits.idleTimeoutMs },
        createChatMapper(),
      );
      return { response, output: { mode: "stream", events } };
    } finally {
      if (!streamHandedOff) coordinator.dispose();
    }
  }

  countTokens(_input: TokenCountInput): Promise<ContextStats> {
    return Promise.resolve({ tokens: null, source: "unknown" });
  }

  mapError(error: unknown): ProviderCallError {
    return toProviderCallError(error);
  }
}

export const __test__ = {
  injectFreebuffMarker,
  rootAgentIdForModel,
  FREEBUFF_SYSTEM_MARKER,
  resetSessionCache: () => sessionCache.clear(),
};
