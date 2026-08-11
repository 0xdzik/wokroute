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
import type { SseEvent, StreamMapper } from "./shared";
import type {
  ContextStats,
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
import type { NormalizedProviderRequest } from "../domain/contracts";
import type { StopReason, StreamDecoder, StreamDecoderInput, StreamEvent } from "../domain/contracts";
import { callChatCompletionsWire } from "../transport/protocols/openai";

/**
 * GitHub Copilot adapter: OpenAI-compatible chat completions with Copilot's
 * special headers and token exchange.
 *
 * Authentication flow:
 *   1) GitHub OAuth → GitHub access token
 *   2) Exchange GitHub access token for Copilot token via /copilot_internal/v2/token
 *   3) Use Copilot token for chat completions
 *
 * Models are dynamically fetched from /models endpoint at runtime.
 */

const GITHUB_COPILOT_SURFACES: readonly ProviderSurface[] = ["openai-chat"];

const GITHUB_COPILOT_DEFAULT_MODELS: readonly ProviderModel[] = [
  modelOf("gpt-5.2", "GPT-5.2", capabilitiesOf({ surfaces: GITHUB_COPILOT_SURFACES })),
  modelOf("gpt-5.2-codex", "GPT-5.2 Codex", capabilitiesOf({ surfaces: GITHUB_COPILOT_SURFACES })),
  modelOf("gpt-5.3-codex", "GPT-5.3 Codex", capabilitiesOf({ surfaces: GITHUB_COPILOT_SURFACES })),
  modelOf("gpt-5.4", "GPT-5.4", capabilitiesOf({ surfaces: GITHUB_COPILOT_SURFACES })),
  modelOf("gpt-5.4-mini", "GPT-5.4 Mini", capabilitiesOf({ surfaces: GITHUB_COPILOT_SURFACES })),
  modelOf("claude-haiku-4.5", "Claude Haiku 4.5", capabilitiesOf({ surfaces: GITHUB_COPILOT_SURFACES })),
  modelOf("claude-opus-4.5", "Claude Opus 4.5", capabilitiesOf({ surfaces: GITHUB_COPILOT_SURFACES })),
  modelOf("claude-sonnet-4.5", "Claude Sonnet 4.5", capabilitiesOf({ surfaces: GITHUB_COPILOT_SURFACES })),
  modelOf("claude-sonnet-4.6", "Claude Sonnet 4.6", capabilitiesOf({ surfaces: GITHUB_COPILOT_SURFACES })),
  modelOf("gemini-2.5-pro", "Gemini 2.5 Pro", capabilitiesOf({ surfaces: GITHUB_COPILOT_SURFACES })),
  modelOf("gemini-3-flash-preview", "Gemini 3 Flash", capabilitiesOf({ surfaces: GITHUB_COPILOT_SURFACES })),
];

const GITHUB_COPILOT_FALLBACK_CAPABILITIES: ProviderCapabilities = capabilitiesOf({
  surfaces: GITHUB_COPILOT_SURFACES,
});

/** Copilot version strings — must match VSCode + Copilot Chat extension versions */
const COPILOT_VSCODE_VERSION = "1.110.0";
const COPILOT_CHAT_VERSION = "0.38.0";
const COPILOT_USER_AGENT = "GitHubCopilotChat/0.38.0";
const COPILOT_API_VERSION = "2025-04-01";

const GITHUB_COPILOT_BASE_URL = "https://api.githubcopilot.com/chat/completions";
const GITHUB_COPILOT_MODELS_URL = "https://api.githubcopilot.com/models";
const GITHUB_COPILOT_TOKEN_URL = "https://api.github.com/copilot_internal/v2/token";

export interface GitHubCopilotAdapterConfig {
  readonly baseUrl?: string;
  readonly modelsUrl?: string;
  readonly tokenUrl?: string;
}

export class GitHubCopilotAdapter implements ProviderAdapter {
  readonly metadata: ProviderMetadata = {
    id: "github-copilot",
    displayName: "GitHub Copilot",
    protocol: "openai",
    credentialKind: "oauth",
  };

  readonly models: ProviderModelCatalog = createModelCatalog(GITHUB_COPILOT_DEFAULT_MODELS);
  readonly capabilities: ProviderCapabilities = {
    ...GITHUB_COPILOT_FALLBACK_CAPABILITIES,
    streaming: true,
  };

  private readonly baseUrl: string;
  private readonly modelsUrl: string;
  private readonly tokenUrl: string;

  constructor(config: GitHubCopilotAdapterConfig = {}) {
    this.baseUrl = config.baseUrl ?? GITHUB_COPILOT_BASE_URL;
    this.modelsUrl = config.modelsUrl ?? GITHUB_COPILOT_MODELS_URL;
    this.tokenUrl = config.tokenUrl ?? GITHUB_COPILOT_TOKEN_URL;
  }

  resolveTarget(modelId: string, surface: ProviderSurface): RouteTarget {
    if (!this.capabilities.surfaces.includes(surface)) {
      throw new ProviderAdapterError({
        kind: "capability_unsupported",
        message: `Provider "${this.metadata.id}" does not support surface "${surface}"`,
        statusCode: 400,
        routeScope: null,
      });
    }
    const entry = this.models.get(modelId);
    return {
      providerId: this.metadata.id,
      modelId,
      upstreamModelId: entry?.upstreamId ?? modelId,
      surface,
    };
  }

  async call(input: ProviderRequest): Promise<ProviderOutput> {
    if (input.target.providerId !== this.metadata.id || input.target.surface !== "openai-chat") {
      throw new ProviderAdapterError({
        kind: "capability_unsupported",
        message: `Provider "${this.metadata.id}" only supports the OpenAI Chat surface`,
        statusCode: 400,
        routeScope: null,
      });
    }

    if (!input.credential) {
      throw new ProviderAdapterError({
        kind: "authentication_failed",
        message: "GitHub Copilot requires OAuth authentication",
        statusCode: 401,
        routeScope: "account",
      });
    }

    // The credential here is the Copilot token (after OAuth + token exchange)
    const copilotToken = input.credential;

    const request = { ...input.request, model: input.target.upstreamModelId };
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: request.stream ? "text/event-stream" : "application/json",
      authorization: `Bearer ${copilotToken}`,
      "copilot-integration-id": "vscode-chat",
      "editor-version": `vscode/${COPILOT_VSCODE_VERSION}`,
      "editor-plugin-version": `copilot-chat/${COPILOT_CHAT_VERSION}`,
      "user-agent": COPILOT_USER_AGENT,
      "openai-intent": "conversation-panel",
      "x-github-api-version": COPILOT_API_VERSION,
    };

    const userAgent = input.headers?.get("user-agent");
    if (userAgent) headers["user-agent"] = userAgent;

    return callChatCompletionsWire({ ...input, request }, this.baseUrl, headers);
  }

  countTokens(_input: TokenCountInput): Promise<ContextStats> {
    return Promise.resolve({ tokens: null, source: "unknown" });
  }

  mapError(error: unknown): ProviderCallError {
    return toProviderCallError(error);
  }
}

export const githubCopilotModelCatalog = GITHUB_COPILOT_DEFAULT_MODELS;
