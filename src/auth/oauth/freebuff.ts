import type { AuthDriver, OAuthStartInput, OAuthStartResult, RefreshTokenInput, TokenSet } from "../contracts";
import { OAuthDriverError, type OAuthDriverOptions } from "./base";

/**
 * Freebuff / Codebuff CLI login — fingerprint device-flow (NOT OAuth2):
 *   1) POST {baseUrl}/api/auth/cli/code { fingerprintId }
 *      → { fingerprintId, fingerprintHash, loginUrl, expiresAt }
 *      (Server echoes the request host into loginUrl, so calling freebuff.com
 *      yields freebuff.com/login?auth_code=… — exactly the link the official
 *      CLI shows. www.codebuff.com would return the wrong link.)
 *   2) User opens loginUrl in a browser and signs in / confirms the device
 *   3) GET {baseUrl}/api/auth/cli/status?fingerprintId=..&fingerprintHash=..&expiresAt=..
 *      → { user: { id, email, name, authToken, fingerprintId, ... } } once authorized
 *
 * The resulting user.authToken is the Bearer token used against the
 * OpenAI-compatible endpoint https://www.codebuff.com/api/v1/chat/completions
 * (same backend, different host — freebuff.com does not serve /api/v1/*).
 *
 * The fingerprintId + fingerprintHash + expiresAt triple rides in the `state`
 * and is decoded on every poll.
 */
const LOGIN_HOST = "https://freebuff.com";
const LOGIN_CODE_PATH = "/api/auth/cli/code";
const LOGIN_STATUS_PATH = "/api/auth/cli/status";
const FREEBUFF_TIMEOUT_MS = 300_000; // 5-minute deadline (official CLI stops polling here)
const POLL_INTERVAL_SECONDS = 5;
const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = "codebuff-cli/0.0.138";

interface FreebuffDeviceContext {
  readonly fingerprintId: string;
  readonly fingerprintHash: string;
  readonly expiresAt: number;
  readonly startedAtMs: number;
}

export interface FreebuffOAuthDriverOptions extends OAuthDriverOptions {
  readonly baseUrl?: string;
}

/**
 * Freebuff device-flow OAuth driver. Implements start/poll; no refresh
 * (the authToken has no refresh path — the user re-logs in when it dies).
 */
export class FreebuffOAuthDriver implements AuthDriver {
  readonly kind = "oauth" as const;
  private readonly baseUrl: string;
  private readonly nowMs: () => number;
  private readonly devices = new Map<string, FreebuffDeviceContext>();

  constructor(options: FreebuffOAuthDriverOptions = {}) {
    this.baseUrl = (options.baseUrl ?? LOGIN_HOST).replace(/\/$/, "");
    this.nowMs = options.nowMs ?? (() => Date.now());
  }

  async start(_input: OAuthStartInput): Promise<OAuthStartResult> {
    const state = crypto.randomUUID();
    const fingerprintId = crypto.randomUUID();

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${LOGIN_CODE_PATH}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "user-agent": USER_AGENT,
        },
        body: JSON.stringify({ fingerprintId }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      throw new OAuthDriverError("network", `Freebuff login code request failed: ${error instanceof Error ? error.message : "network error"}`, 0, true);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new OAuthDriverError("authorization_denied", `Freebuff login code request failed (${response.status}): ${body.slice(0, 200)}`, response.status, false);
    }

    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    const loginUrl = typeof data.loginUrl === "string" ? data.loginUrl : "";
    const fingerprintHash = typeof data.fingerprintHash === "string" ? data.fingerprintHash : "";
    const serverFingerprintId = typeof data.fingerprintId === "string" ? data.fingerprintId : fingerprintId;
    const serverExpiresAt = Number(data.expiresAt) || 0;

    if (this.devices.size >= 500) {
      const oldest = this.devices.keys().next().value;
      if (oldest !== undefined) this.devices.delete(oldest);
    }
    this.devices.set(state, {
      fingerprintId: serverFingerprintId,
      fingerprintHash,
      expiresAt: serverExpiresAt,
      startedAtMs: this.nowMs(),
    });

    // Server codes live ~1h, but the CLI stops polling after 5 minutes.
    // Clamp expiresAtMs to the 5-minute deadline so the modal doesn't hammer
    // /api/auth/cli/status for an hour.
    const now = this.nowMs();
    const deadlineMs = now + FREEBUFF_TIMEOUT_MS;
    const serverDeadlineMs = Number.isFinite(serverExpiresAt) && serverExpiresAt > 0 ? serverExpiresAt : deadlineMs;
    const expiresAtMs = Math.min(serverDeadlineMs, deadlineMs);

    return {
      authorizationUrl: loginUrl,
      state,
      expiresAtMs,
      intervalSeconds: POLL_INTERVAL_SECONDS,
    };
  }

  /**
   * Non-blocking device-flow poll: makes a single GET to /api/auth/cli/status
   * and returns the result. Returns `authorization_pending` while the device
   * is still waiting for browser sign-in, and `completed` once the server
   * returns a `user` payload with an `authToken`.
   */
  async poll(state: string): Promise<{ readonly status: "pending" | "completed" | "expired"; readonly tokenSet?: TokenSet }> {
    const context = this.devices.get(state);
    if (context === undefined) return { status: "expired" };
    if (this.nowMs() > context.startedAtMs + FREEBUFF_TIMEOUT_MS) {
      this.devices.delete(state);
      return { status: "expired" };
    }

    const query = new URLSearchParams({
      fingerprintId: context.fingerprintId,
      fingerprintHash: context.fingerprintHash,
      expiresAt: String(context.expiresAt),
    });

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${LOGIN_STATUS_PATH}?${query.toString()}`, {
        method: "GET",
        headers: { accept: "application/json", "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch {
      return { status: "pending" };
    }

    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    const user = data.user;
    if (user !== null && typeof user === "object" && !Array.isArray(user)) {
      const authToken = (user as Record<string, unknown>).authToken;
      if (typeof authToken === "string" && authToken.length > 0) {
        this.devices.delete(state);
        return {
          status: "completed",
          tokenSet: {
            accessToken: authToken,
            refreshToken: undefined,
            email: typeof (user as Record<string, unknown>).email === "string" ? (user as Record<string, unknown>).email as string : undefined,
            providerAccountId: typeof (user as Record<string, unknown>).id === "string" ? (user as Record<string, unknown>).id as string : undefined,
          },
        };
      }
    }
    return { status: "pending" };
  }

  refresh(_input: RefreshTokenInput): Promise<TokenSet> {
    return Promise.reject(new OAuthDriverError("validation", "Freebuff tokens do not support refresh — re-login in the dashboard.", 400, false));
  }
}
