import type { AuthDriver, OAuthStartInput, OAuthStartResult, RefreshTokenInput, TokenSet } from "../contracts";
import { OAuthDriverError, OAuthHttpClient, type OAuthDriverOptions } from "./base";

/**
 * GitHub Copilot OAuth driver using GitHub's device flow.
 *
 * Flow:
 *   1) POST https://github.com/login/device/code → user_code + device_code
 *   2) User visits verification_uri and enters user_code
 *   3) Poll https://github.com/login/oauth/access_token until authorized
 *   4) Exchange GitHub access token for Copilot token via /copilot_internal/v2/token
 *
 * The Copilot token (not the GitHub token) is what's stored and used for API calls.
 */

export const GITHUB_COPILOT_CLIENT_ID = "Iv1.b507a08c87ecfe98";
export const GITHUB_COPILOT_DEVICE_CODE_URL = "https://github.com/login/device/code";
export const GITHUB_COPILOT_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const GITHUB_COPILOT_SCOPE = "read:user";
export const GITHUB_COPILOT_API_VERSION = "2022-11-28";
export const GITHUB_COPILOT_TOKEN_EXCHANGE_URL = "https://api.github.com/copilot_internal/v2/token";
export const GITHUB_COPILOT_USER_AGENT = "GitHubCopilotChat/0.38.0";
export const GITHUB_COPILOT_VSCODE_VERSION = "1.110.0";
export const GITHUB_COPILOT_CHAT_VERSION = "0.38.0";

export const GITHUB_COPILOT_REFRESH_LEAD_MS = 5 * 60_000;
export const GITHUB_COPILOT_DEVICE_DEFAULT_EXPIRES_IN_SECONDS = 900;
export const GITHUB_COPILOT_DEVICE_DEFAULT_INTERVAL_SECONDS = 5;
export const GITHUB_COPILOT_MAX_DEVICE_SESSIONS = 500;

interface GitHubCopilotDeviceContext {
  readonly deviceCode: string;
  readonly expiresAtMs: number;
  readonly intervalSeconds: number;
}

export interface GitHubCopilotOAuthDriverOptions extends OAuthDriverOptions {
  readonly clientId?: string;
}

/**
 * Parses GitHub OAuth token response.
 * GitHub returns: access_token, refresh_token, expires_in, scope, token_type
 */
function parseGitHubTokenResponse(
  data: Record<string, unknown>,
  operation: string,
  nowMs: number,
  fallbackRefreshToken?: string,
): { githubAccessToken: string; githubRefreshToken?: string; expiresAtMs: number } {
  const accessToken = data.access_token;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new OAuthDriverError("validation", `GitHub ${operation} response missing access_token`, 400, false);
  }

  const refreshToken = typeof data.refresh_token === "string" ? data.refresh_token : fallbackRefreshToken;
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 28800; // 8 hours default
  const expiresAtMs = nowMs + expiresIn * 1000;

  return { githubAccessToken: accessToken, githubRefreshToken: refreshToken, expiresAtMs };
}

/**
 * Exchanges a GitHub access token for a Copilot token.
 * Returns the Copilot token and its expiry.
 */
async function exchangeForCopilotToken(
  http: OAuthHttpClient,
  githubAccessToken: string,
  nowMs: number,
): Promise<{ copilotToken: string; expiresAtMs: number }> {
  const result = await http.tryGet(
    GITHUB_COPILOT_TOKEN_EXCHANGE_URL,
    {
      "Authorization": `token ${githubAccessToken}`,
      "Accept": "application/json",
      "User-Agent": GITHUB_COPILOT_USER_AGENT,
      "Editor-Version": `vscode/${GITHUB_COPILOT_VSCODE_VERSION}`,
      "Editor-Plugin-Version": `copilot-chat/${GITHUB_COPILOT_CHAT_VERSION}`,
      "X-GitHub-Api-Version": GITHUB_COPILOT_API_VERSION,
    },
    "github-copilot",
    "token exchange",
  );

  if (!result.ok) {
    throw new OAuthDriverError(
      "upstream",
      `Copilot token exchange failed: ${result.status}`,
      result.status,
      result.status >= 500 || result.status === 408 || result.status === 429,
    );
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(result.text) as Record<string, unknown>;
  } catch {
    throw new OAuthDriverError("malformed-response", "Copilot token exchange returned invalid JSON", 502, false);
  }

  const copilotToken = data.token;
  if (typeof copilotToken !== "string" || copilotToken.length === 0) {
    throw new OAuthDriverError("validation", "Copilot token exchange response missing token", 400, false);
  }

  // Copilot tokens have expires_at (Unix timestamp in seconds)
  const expiresAt = typeof data.expires_at === "number" ? data.expires_at : Math.floor((nowMs + 3600_000) / 1000);
  const expiresAtMs = expiresAt * 1000;

  return { copilotToken, expiresAtMs };
}

/**
 * GitHub Copilot device-code OAuth driver.
 *
 * Implements start/poll/refresh. The stored token is the Copilot token
 * (after exchange), not the GitHub access token.
 */
export class GitHubCopilotOAuthDriver implements AuthDriver {
  readonly kind = "oauth" as const;

  private readonly clientId: string;
  private readonly http: OAuthHttpClient;
  private readonly nowMs: () => number;
  private readonly devices = new Map<string, GitHubCopilotDeviceContext>();

  constructor(options: GitHubCopilotOAuthDriverOptions = {}) {
    this.clientId = options.clientId ?? GITHUB_COPILOT_CLIENT_ID;
    this.http = new OAuthHttpClient({ timeoutMs: options.timeoutMs });
    this.nowMs = options.nowMs ?? (() => Date.now());
  }

  async start(_input: OAuthStartInput): Promise<OAuthStartResult> {
    if (this.devices.size >= GITHUB_COPILOT_MAX_DEVICE_SESSIONS) {
      // Evict oldest expired session
      for (const [state, ctx] of this.devices) {
        if (ctx.expiresAtMs < this.nowMs()) {
          this.devices.delete(state);
          break;
        }
      }
      if (this.devices.size >= GITHUB_COPILOT_MAX_DEVICE_SESSIONS) {
        throw new OAuthDriverError("validation", "Too many pending GitHub Copilot OAuth sessions", 429, true);
      }
    }

    const data = await this.http.postForm(
      GITHUB_COPILOT_DEVICE_CODE_URL,
      { client_id: this.clientId, scope: GITHUB_COPILOT_SCOPE },
      "github-copilot",
      "device code",
      { Accept: "application/json" },
    );

    const deviceCode = data.device_code;
    const userCode = data.user_code;
    const verificationUri = data.verification_uri;
    const expiresIn = typeof data.expires_in === "number" ? data.expires_in : GITHUB_COPILOT_DEVICE_DEFAULT_EXPIRES_IN_SECONDS;
    const intervalSeconds = typeof data.interval === "number" ? data.interval : GITHUB_COPILOT_DEVICE_DEFAULT_INTERVAL_SECONDS;

    if (typeof deviceCode !== "string" || typeof userCode !== "string" || typeof verificationUri !== "string") {
      throw new OAuthDriverError("validation", "GitHub device code response missing required fields", 400, false);
    }

    const nowMs = this.nowMs();
    const state = `ghcp-${nowMs}-${Math.random().toString(36).slice(2, 10)}`;
    const expiresAtMs = nowMs + expiresIn * 1000;

    this.devices.set(state, {
      deviceCode,
      expiresAtMs,
      intervalSeconds,
    });

    return {
      authorizationUrl: verificationUri,
      state,
      expiresAtMs,
      userCode,
      verificationUri,
      intervalSeconds,
    };
  }

  async poll(state: string): Promise<{ readonly status: "pending" | "completed" | "expired"; readonly intervalSeconds?: number; readonly tokenSet?: TokenSet }> {
    const context = this.devices.get(state);
    if (!context) {
      throw new OAuthDriverError("validation", "Unknown GitHub Copilot OAuth session", 400, false);
    }

    const nowMs = this.nowMs();
    if (context.expiresAtMs < nowMs) {
      this.devices.delete(state);
      return { status: "expired" };
    }

    let data: Record<string, unknown>;
    try {
      data = await this.http.postForm(
        GITHUB_COPILOT_TOKEN_URL,
        {
          client_id: this.clientId,
          device_code: context.deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        },
        "github-copilot",
        "device poll",
        { Accept: "application/json" },
      );
    } catch (error) {
      // postForm throws on HTTP errors; check for specific OAuth error codes
      if (error instanceof OAuthDriverError && error.message.includes("400")) {
        // 400 errors from GitHub device flow contain error codes in response
        // We need to handle them specially - re-fetch to get the actual error
        const result = await this.http.tryGet(
          `${GITHUB_COPILOT_TOKEN_URL}?client_id=${this.clientId}&device_code=${context.deviceCode}&grant_type=urn:ietf:params:oauth:grant-type:device_code`,
          { Accept: "application/json" },
          "github-copilot",
          "device poll check",
        );
        if (result.ok) {
          try {
            data = JSON.parse(result.text) as Record<string, unknown>;
          } catch {
            throw error;
          }
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    // Check for pending/error states
    const error = data.error;
    if (typeof error === "string") {
      if (error === "authorization_pending") {
        return { status: "pending", intervalSeconds: context.intervalSeconds };
      }
      if (error === "slow_down") {
        return { status: "pending", intervalSeconds: context.intervalSeconds + 5 };
      }
      if (error === "expired_token") {
        this.devices.delete(state);
        return { status: "expired" };
      }
      if (error === "access_denied") {
        this.devices.delete(state);
        throw new OAuthDriverError("upstream", "User denied GitHub Copilot authorization", 403, false);
      }
      throw new OAuthDriverError("upstream", `GitHub OAuth error: ${error}`, 400, false);
    }

    // Success — parse GitHub tokens
    const { githubAccessToken, githubRefreshToken } = parseGitHubTokenResponse(data, "device poll", nowMs);

    // Exchange GitHub access token for Copilot token
    const { copilotToken, expiresAtMs } = await exchangeForCopilotToken(this.http, githubAccessToken, nowMs);

    this.devices.delete(state);

    return {
      status: "completed",
      tokenSet: {
        accessToken: copilotToken,
        refreshToken: githubRefreshToken, // Store GitHub refresh token for later refresh
        expiresAt: new Date(expiresAtMs).toISOString(),
        scope: GITHUB_COPILOT_SCOPE,
      },
    };
  }

  async refresh(input: RefreshTokenInput): Promise<TokenSet> {
    const { refreshToken } = input;
    if (!refreshToken) {
      throw new OAuthDriverError("validation", "GitHub Copilot refresh requires a refresh token", 400, false);
    }

    const nowMs = this.nowMs();

    // First, refresh the GitHub access token
    const githubData = await this.http.postForm(
      GITHUB_COPILOT_TOKEN_URL,
      {
        client_id: this.clientId,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      },
      "github-copilot",
      "refresh",
      { Accept: "application/json" },
    );

    const { githubAccessToken, githubRefreshToken } = parseGitHubTokenResponse(githubData, "refresh", nowMs, refreshToken);

    // Exchange the new GitHub access token for a new Copilot token
    const { copilotToken, expiresAtMs } = await exchangeForCopilotToken(this.http, githubAccessToken, nowMs);

    return {
      accessToken: copilotToken,
      refreshToken: githubRefreshToken,
      expiresAt: new Date(expiresAtMs).toISOString(),
      scope: GITHUB_COPILOT_SCOPE,
    };
  }
}
