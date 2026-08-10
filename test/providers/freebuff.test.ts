import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { FreebuffAdapter, __test__ } from "../../src/providers/freebuff";
import { FreebuffOAuthDriver } from "../../src/auth/oauth/freebuff";
import { ProviderAdapterError } from "../../src/providers/shared";
import type { ProviderRequest } from "../../src/domain/contracts";

const { injectFreebuffMarker, rootAgentIdForModel, FREEBUFF_SYSTEM_MARKER, resetSessionCache } = __test__;

const SESSION_URL = "https://www.codebuff.com/api/v1/freebuff/session";
const RUN_URL = "https://www.codebuff.com/api/v1/agent-runs";
const CHAT_URL = "https://www.codebuff.com/api/v1/chat/completions";
const MODEL = "deepseek/deepseek-v4-flash";

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function makeRequest(credential: string, overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  return {
    target: { providerId: "freebuff", modelId: MODEL, upstreamModelId: MODEL, surface: "openai-chat" },
    request: {
      model: MODEL,
      messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
      tools: [],
      stream: false,
      responseFormat: "text",
      reasoning: "default",
      maxOutputTokens: null,
      images: [],
      sourceSurface: "openai-chat",
      signal: new AbortController().signal,
      limits: { maxBodyBytes: 1_000_000, connectTimeoutMs: 5_000, firstByteTimeoutMs: 5_000, idleTimeoutMs: 5_000, totalTimeoutMs: 10_000 },
    },
    credential,
    network: { proxyId: null, url: null, release: async () => {} },
    signal: new AbortController().signal,
    ...overrides,
  };
}

const originalFetch = globalThis.fetch;
beforeEach(() => { resetSessionCache(); });
afterEach(() => { globalThis.fetch = originalFetch; });

// ─────────────────────────── OAuth driver ───────────────────────────

describe("FreebuffOAuthDriver — device-code flow", () => {
  test("start posts a fingerprint to freebuff.com and returns the login URL", async () => {
    const loginUrl = "https://freebuff.com/login?auth_code=AbCd-123";
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      if (String(url).includes("/api/auth/cli/code")) {
        return jsonResponse({ fingerprintId: "fp-1", fingerprintHash: "hash-1", loginUrl, expiresAt: Date.now() + 60000 });
      }
      throw new Error("unexpected");
    }) as never;
    const driver = new FreebuffOAuthDriver();
    const result = await driver.start({ providerId: "freebuff" });
    expect(result.authorizationUrl).toBe(loginUrl);
    expect(result.intervalSeconds).toBe(5);
    expect(result.state.length).toBeGreaterThan(0);
  });

  test("start clamps expiresAtMs to 5-minute deadline", async () => {
    globalThis.fetch = mock(async () => jsonResponse({ fingerprintId: "fp-1", fingerprintHash: "h", loginUrl: "https://freebuff.com/login", expiresAt: Date.now() + 3600000 })) as never;
    const driver = new FreebuffOAuthDriver({ nowMs: () => 1_000_000 });
    const result = await driver.start({ providerId: "freebuff" });
    expect(result.expiresAtMs).toBe(1_000_000 + 300_000);
  });

  test("poll returns pending on 401 while device is waiting", async () => {
    let codeCall = true;
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const u = String(url);
      if (codeCall && u.includes("/api/auth/cli/code")) { codeCall = false; return jsonResponse({ fingerprintId: "fp-1", fingerprintHash: "h", loginUrl: "https://freebuff.com/login", expiresAt: Date.now() + 60000 }); }
      return new Response(JSON.stringify({ error: "Authentication failed" }), { status: 401 });
    }) as never;
    const driver = new FreebuffOAuthDriver();
    const start = await driver.start({ providerId: "freebuff" });
    const result = await driver.poll(start.state);
    expect(result.status).toBe("pending");
  });

  test("poll returns completed with authToken on success", async () => {
    let codeCall = true;
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      if (codeCall) { codeCall = false; return jsonResponse({ fingerprintId: "fp-1", fingerprintHash: "h", loginUrl: "https://freebuff.com/login", expiresAt: Date.now() + 60000 }); }
      return jsonResponse({ user: { id: "u1", email: "a@b.c", name: "A", authToken: "tok-123", fingerprintId: "fp-1" } });
    }) as never;
    const driver = new FreebuffOAuthDriver();
    const start = await driver.start({ providerId: "freebuff" });
    const result = await driver.poll(start.state);
    expect(result.status).toBe("completed");
    expect(result.tokenSet?.accessToken).toBe("tok-123");
  });

  test("poll returns expired for unknown state", async () => {
    const driver = new FreebuffOAuthDriver();
    const result = await driver.poll("unknown-state");
    expect(result.status).toBe("expired");
  });

  test("refresh rejects (tokens are non-refreshable)", async () => {
    const driver = new FreebuffOAuthDriver();
    expect(driver.refresh({ providerId: "freebuff", accountId: "a1", refreshToken: "r" })).rejects.toThrow(/re-login/i);
  });
});

// ─────────────────────────── marker injection ───────────────────────────

describe("injectFreebuffMarker", () => {
  test("prepends marker when first message is a system prompt", () => {
    const out = injectFreebuffMarker({ messages: [{ role: "system", content: "You are a helpful assistant." }, { role: "user", content: "hi" }] });
    const messages = out.messages as Array<{ role: string; content: string }>;
    expect(messages[0]!.content).toBe(`${FREEBUFF_SYSTEM_MARKER}\n\nYou are a helpful assistant.`);
  });

  test("inserts marker system message when first message is not system", () => {
    const out = injectFreebuffMarker({ messages: [{ role: "user", content: "hi" }] });
    const messages = out.messages as Array<{ role: string; content: string }>;
    expect(messages[0]).toEqual({ role: "system", content: FREEBUFF_SYSTEM_MARKER });
    expect(messages[1]).toEqual({ role: "user", content: "hi" });
  });

  test("is idempotent when first system message already opens with the marker", () => {
    const messages = [{ role: "system", content: FREEBUFF_SYSTEM_MARKER }];
    const out = injectFreebuffMarker({ messages });
    expect(out.messages).toBe(messages);
  });
});

// ─────────────────────────── root agent mapping ───────────────────────────

describe("rootAgentIdForModel", () => {
  test("maps freebuff models to their root free agent ids", () => {
    expect(rootAgentIdForModel("deepseek/deepseek-v4-flash")).toBe("base2-free-deepseek-flash");
    expect(rootAgentIdForModel("deepseek/deepseek-v4-pro")).toBe("base2-free-deepseek");
    expect(rootAgentIdForModel("mimo/mimo-v2.5")).toBe("base2-free-mimo");
    expect(rootAgentIdForModel("minimax/minimax-m3")).toBe("base2-free-minimax-m3");
    expect(rootAgentIdForModel("openai/gpt-5.6-luna")).toBe("base2-free-luna");
    expect(rootAgentIdForModel("some/unknown-model")).toBe("base2-free");
  });
});

// ─────────────────────────── adapter identity ───────────────────────────

describe("FreebuffAdapter — identity & catalog", () => {
  const adapter = new FreebuffAdapter();

  test("declares id freebuff, openai protocol, oauth credential kind", () => {
    expect(adapter.metadata.id).toBe("freebuff");
    expect(adapter.metadata.protocol).toBe("openai");
    expect(adapter.metadata.credentialKind).toBe("oauth");
  });

  test("supports openai-chat surface with streaming", () => {
    expect(adapter.capabilities.surfaces).toContain("openai-chat");
    expect(adapter.capabilities.streaming).toBe(true);
  });

  test("exposes the freebuff model catalog", () => {
    expect(adapter.models.list.length).toBe(5);
    expect(adapter.models.get("deepseek/deepseek-v4-flash")).not.toBeNull();
    expect(adapter.models.get("nonexistent")).toBeNull();
  });

  test("countTokens returns unknown", async () => {
    const result = await adapter.countTokens({ request: {} as never, signal: new AbortController().signal });
    expect(result.source).toBe("unknown");
  });
});

// ─────────────────────────── adapter resolveTarget ───────────────────────────

describe("FreebuffAdapter — resolveTarget", () => {
  const adapter = new FreebuffAdapter();

  test("resolves a known model on openai-chat", () => {
    const target = adapter.resolveTarget("deepseek/deepseek-v4-flash", "openai-chat");
    expect(target.providerId).toBe("freebuff");
    expect(target.upstreamModelId).toBe("deepseek/deepseek-v4-flash");
  });

  test("rejects an unsupported surface", () => {
    expect(() => adapter.resolveTarget("deepseek/deepseek-v4-flash", "openai-responses")).toThrow(ProviderAdapterError);
  });

  test("rejects an unknown model", () => {
    expect(() => adapter.resolveTarget("nonexistent", "openai-chat")).toThrow(ProviderAdapterError);
  });
});

// ─────────────────────────── adapter call guards ───────────────────────────

describe("FreebuffAdapter — call guards", () => {
  const adapter = new FreebuffAdapter();

  test("call rejects an unsupported surface before touching the network", async () => {
    const input = makeRequest("tok", { target: { providerId: "freebuff", modelId: MODEL, upstreamModelId: MODEL, surface: "openai-responses" } });
    expect(adapter.call(input)).rejects.toThrow(ProviderAdapterError);
  });

  test("call rejects an empty credential", async () => {
    const input = makeRequest("");
    expect(adapter.call(input)).rejects.toThrow(/access token is required/i);
  });
});

// ─────────────────────────── adapter call orchestration ───────────────────────────

describe("FreebuffAdapter — call orchestration (session + run + chat)", () => {
  test("sends runId + instanceId on the chat request and finishes the run", async () => {
    const calls: Array<[string, RequestInit]> = [];
    globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      calls.push([u, init ?? {}]);
      if (u === SESSION_URL) return jsonResponse({ status: "active", instanceId: "inst-1", expiresAt: new Date(Date.now() + 3600000).toISOString() });
      if (u === RUN_URL) {
        const body = JSON.parse(init?.body as string);
        if (body.action === "START") return jsonResponse({ runId: "run-1" });
        return jsonResponse({}); // FINISH
      }
      if (u === CHAT_URL) return jsonResponse({ choices: [{ message: { content: "hi" } }] });
      throw new Error(`unexpected url: ${u}`);
    }) as never;

    const adapter = new FreebuffAdapter();
    const input = makeRequest("tok-1");
    const output = await adapter.call(input);

    expect(output.mode).toBe("non_stream");
    const chatCall = calls.find(([u]) => u === CHAT_URL);
    expect(chatCall).toBeDefined();
    const sent = JSON.parse(chatCall![1].body as string);
    expect(sent.codebuff_metadata.run_id).toBe("run-1");
    expect(sent.codebuff_metadata.freebuff_instance_id).toBe("inst-1");
    expect(sent.codebuff_metadata.cost_mode).toBe("free");
    expect(sent.codebuff_metadata.trace_session_id).toMatch(/^[0-9a-f-]+$/);
    expect(sent.codebuff).toBeUndefined();
    expect(sent.provider.allow_fallbacks).toBe(false);
    expect(sent.messages[0].content.startsWith("You are Buffy,")).toBe(true);

    // Run FINISHed as completed
    const finishCall = calls.filter(([u]) => u === RUN_URL).find(([, init]) => JSON.parse(init.body as string).action === "FINISH");
    expect(finishCall).toBeDefined();
    expect(JSON.parse(finishCall![1].body as string).status).toBe("completed");
  });

  test("re-claims session + run on 428 and retries once", async () => {
    let chatHits = 0;
    const calls: Array<[string, RequestInit]> = [];
    globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      calls.push([u, init ?? {}]);
      if (u === SESSION_URL) return jsonResponse({ status: "active", instanceId: "inst-2", expiresAt: new Date(Date.now() + 3600000).toISOString() });
      if (u === RUN_URL) {
        const body = JSON.parse(init?.body as string);
        if (body.action === "START") return jsonResponse({ runId: "run-2" });
        return jsonResponse({});
      }
      chatHits += 1;
      if (chatHits === 1) return new Response(JSON.stringify({ error: "waiting_room_required" }), { status: 428, headers: { "content-type": "application/json" } });
      return jsonResponse({ choices: [{ message: { content: "hi" } }] });
    }) as never;

    const adapter = new FreebuffAdapter();
    const output = await adapter.call(makeRequest("tok-1"));

    expect(output.mode).toBe("non_stream");
    expect(chatHits).toBe(2);
    expect(calls.filter(([u]) => u === SESSION_URL).length).toBe(2);
    expect(calls.filter(([u]) => u === RUN_URL).filter(([, init]) => JSON.parse(init.body as string).action === "START").length).toBe(2);
  });

  test("re-claims session on 409 and retries once", async () => {
    let chatHits = 0;
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const u = String(url);
      if (u === SESSION_URL) return jsonResponse({ status: "active", instanceId: "inst-2", expiresAt: new Date(Date.now() + 3600000).toISOString() });
      if (u === RUN_URL) {
        return jsonResponse({ runId: "run-2" });
      }
      chatHits += 1;
      if (chatHits === 1) return new Response(JSON.stringify({ error: "session_superseded" }), { status: 409, headers: { "content-type": "application/json" } });
      return jsonResponse({ choices: [{ message: { content: "hi" } }] });
    }) as never;

    const adapter = new FreebuffAdapter();
    const output = await adapter.call(makeRequest("tok-1"));
    expect(output.mode).toBe("non_stream");
    expect(chatHits).toBe(2);
  });

  test("throws authentication_failed on 401 from chat", async () => {
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const u = String(url);
      if (u === SESSION_URL) return jsonResponse({ status: "active", instanceId: "inst-1", expiresAt: new Date(Date.now() + 3600000).toISOString() });
      if (u === RUN_URL) return jsonResponse({ runId: "run-1" });
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
    }) as never;

    const adapter = new FreebuffAdapter();
    expect(adapter.call(makeRequest("tok-1"))).rejects.toThrow(ProviderAdapterError);
  });

  test("finishes run as failed when chat returns 400", async () => {
    const calls: Array<[string, RequestInit]> = [];
    globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      calls.push([u, init ?? {}]);
      if (u === SESSION_URL) return jsonResponse({ status: "active", instanceId: "inst-1", expiresAt: new Date(Date.now() + 3600000).toISOString() });
      if (u === RUN_URL) {
        const body = JSON.parse(init?.body as string);
        if (body.action === "START") return jsonResponse({ runId: "run-1" });
        return jsonResponse({});
      }
      return new Response(JSON.stringify({ error: "bad request" }), { status: 400, headers: { "content-type": "application/json" } });
    }) as never;

    const adapter = new FreebuffAdapter();
    expect(adapter.call(makeRequest("tok-1"))).rejects.toThrow(ProviderAdapterError);
    const finishCall = calls.filter(([u]) => u === RUN_URL).find(([, init]) => JSON.parse(init.body as string).action === "FINISH");
    expect(finishCall).toBeDefined();
    expect(JSON.parse(finishCall![1].body as string).status).toBe("failed");
  });
});
