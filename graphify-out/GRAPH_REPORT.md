# Graph Report - src  (2026-08-14)

## Corpus Check
- 163 files · ~171,179 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2715 nodes · 7685 edges · 114 communities (99 shown, 15 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 166 edges (avg confidence: 0.77)
- Token cost: 1,400 input · 1,100 output

## Community Hubs (Navigation)
- Provider Adapter Abstractions
- Provider Request/Stream Pipeline
- Provider Adapter Implementations
- Runtime Utilities & Telemetry
- Domain Contracts
- Repository Layer & Rows
- OAuth Contracts
- Request Normalization
- Anthropic OAuth Constants
- DB Map API
- Runtime Composition
- Auth Driver Interface
- Input Sanitizers
- Console Diagnostics
- Config Backup & Restore
- Quota Fetchers
- Request History Repository
- Routing Policy & Backoff
- Credential Selection
- Anthropic Message Normalization
- Route Transitions
- Account Recovery Sweep
- OAuth Callback Server
- CLI & Autostart
- fs-ops Helper Library
- AgentRouter Adapter
- Qoder Provider Adapter
- Model Metadata
- Console API Router
- Provider Service
- IP Bans & Route Health
- Claude Injector
- CLI Tools Registry
- Stream Recovery Lifecycle
- Auth Service
- OAuth Token Refresh
- Protocol Body Parsing
- Kiro Provider Adapter
- Custom Provider Discovery
- Redirect Policy & Hostname
- OAuth PKCE Utilities
- Console Session Guard
- Warp API & Pool
- Account Service
- Model Probe
- Model Studio Sessions
- Console Wiring
- Request Tracing
- Quota State Store
- Cline OAuth Device Flow
- Native Binary Resolution
- Proxy Request Planning
- Admission Control
- Proxy Repository
- Proxy Edge Entrypoint
- Anthropic OAuth Driver
- Freebuff Provider Adapter
- OAuth Coordinator
- Kiro OAuth Driver
- Warp Pool Service
- Grok Build OAuth Constants
- Traffic Limits
- API Key Service
- Filter Rule Service
- Routing Config Service
- GitHub Copilot Adapter
- Proxy Request Execution
- Console Log Stream Hub
- Response Writer
- OAuth HTTP Client
- Proxy Health Manager
- Prompt Cache Planner
- Message Content Normalization
- CommandCode Adapter
- Surface Stream Encoders
- Warp Types & Export
- Protocol Translation
- Rate Limit Handling
- Token Saver
- API Key Repository
- Proxy Pool
- Antigravity OAuth Driver
- Metrics Collector
- Cline Provider Adapter
- Model Service
- Account Health Store
- Cline Injector
- Injector Guide
- Kilo Injector
- Console Static Serving
- Terminal WebSocket
- WGCF Account Registration
- Account Repository
- Settings Repository
- Hermes Injector
- 9Router Backup Import
- Observability Metrics
- Exa Search Adapter
- Proxy Settings Repository
- Proxy Fetchers
- Per-IP Flight Tracker
- Runtime Settings
- OpenCode Injector
- Model Repository
- Warp Account Repository
- Error Types
- Injector Contract Spec
- Custom Provider Repository
- Share Link Repository
- Console Log Repository
- Warp Metrics Repository
- Route ACL
- Proxy Pool Injector
- Proxy Slot Handle

## God Nodes (most connected - your core abstractions)
1. `isRecord()` - 60 edges
2. `ProviderSurface` - 59 edges
3. `ProviderCallError` - 58 edges
4. `ProviderAdapter` - 57 edges
5. `ProviderOutput` - 55 edges
6. `ProviderRequest` - 54 edges
7. `RouteTarget` - 48 edges
8. `ProviderMetadata` - 47 edges
9. `ProviderCapabilities` - 47 edges
10. `executeFetch()` - 47 edges

## Surprising Connections (you probably didn't know these)
- `createwokrouteRuntime()` --indirect_call--> `probeProviderModel()`  [INFERRED]
  app/composition.ts → console/probe.ts
- `SnapshotAccountRow` --references--> `CredentialKind`  [EXTRACTED]
  app/routing-snapshot.ts → domain/contracts.ts
- `NetworkSelectionResult` --references--> `NetworkSelection`  [EXTRACTED]
  traffic/network.ts → domain/contracts.ts
- `wokrouteRuntime` --references--> `ConsoleRepositories`  [EXTRACTED]
  app/composition.ts → console/views.ts
- `wokrouteRuntime` --references--> `ConfigPersistence`  [EXTRACTED]
  app/composition.ts → storage/main/config.ts

## Import Cycles
- 2-file cycle: `domain/protocols.ts -> domain/protocols/images.ts -> domain/protocols.ts`
- 2-file cycle: `domain/protocols.ts -> domain/protocols/anthropic-messages.ts -> domain/protocols.ts`
- 2-file cycle: `domain/protocols.ts -> domain/protocols/surface.ts -> domain/protocols.ts`
- 2-file cycle: `domain/protocols.ts -> domain/protocols/openai-responses.ts -> domain/protocols.ts`
- 2-file cycle: `domain/protocols.ts -> domain/protocols/openai-chat.ts -> domain/protocols.ts`
- 3-file cycle: `domain/protocols.ts -> domain/protocols/openai-chat.ts -> domain/protocols/openai-responses.ts -> domain/protocols.ts`
- 3-file cycle: `console/views.ts -> storage/index.ts -> storage/main/config.ts -> console/views.ts`
- 5-file cycle: `auth/credentials.ts -> traffic/index.ts -> traffic/admission.ts -> storage/index.ts -> storage/main/config.ts -> auth/credentials.ts`

## Hyperedges (group relationships)
- **Injector Contract Core Shapes** — src_console_cli_tools_injectors_contract_toolinjector, src_console_cli_tools_injectors_contract_toolstatus, src_console_cli_tools_injectors_contract_applyinput, src_console_cli_tools_injectors_contract_fs_ops_helpers [EXTRACTED 1.00]

## Communities (114 total, 15 thin omitted)

### Community 0 - "Provider Adapter Abstractions"
Cohesion: 0.05
Nodes (47): ProviderAdapter, ProviderCallError, ProviderCapabilities, ProviderMetadata, ProviderModelCatalog, ProviderSurface, RouteTarget, AgentRouterAdapter (+39 more)

### Community 1 - "Provider Request/Stream Pipeline"
Cohesion: 0.07
Nodes (65): ProviderOutput, ProviderRequest, StreamDecoder, StreamDecoderInput, StreamEvent, buildMessagesPayload(), mapAnthropicUsage(), buildChatPayload() (+57 more)

### Community 2 - "Provider Adapter Implementations"
Cohesion: 0.05
Nodes (65): RFC-9110, AlibabaAdapter, alibabaConfig, BlackboxAIAdapter, blackboxaiConfig, NATIVE_SURFACES, CerebrasAdapter, cerebrasConfig (+57 more)

### Community 3 - "Runtime Utilities & Telemetry"
Cohesion: 0.04
Nodes (53): envCredentialStore(), ClientDetectionSource, ClientName, TelemetryFinish, BoundedTtlCache, clearAllRuntimeTables(), ConsoleLogFilters, createConsoleLogRepository() (+45 more)

### Community 4 - "Domain Contracts"
Cohesion: 0.06
Nodes (57): AccountChoice, AuthorizedProxyRequest, boundedRetryAt(), CleanupHandle, ContentBlock, ErrorSource, NormalizedMessage, ProviderModel (+49 more)

### Community 5 - "Repository Layer & Rows"
Cohesion: 0.07
Nodes (56): AccessRuleRow, AccountHealthRow, AliasRow, ApiKeyRow, ComboRow, createAccessRuleRepository(), createAccountRepository(), createAliasRepository() (+48 more)

### Community 6 - "OAuth Contracts"
Cohesion: 0.08
Nodes (28): OAuthExchangeInput, OAuthStartResult, RefreshTokenInput, RevokeTokenInput, TokenSet, OAuthDriverOptions, ClineOAuthDriverOptions, ClinePassOAuthDriver (+20 more)

### Community 7 - "Request Normalization"
Cohesion: 0.17
Nodes (46): abortedError(), normalizeBlock(), normalizeContent(), normalizeImage(), normalizeMaxTokens(), normalizeMessage(), normalizeMessages(), normalizeMessagesRequest() (+38 more)

### Community 8 - "Anthropic OAuth Constants"
Cohesion: 0.07
Nodes (41): ANTHROPIC_OAUTH_AUTHORIZE_URL, ANTHROPIC_OAUTH_BETA, ANTHROPIC_OAUTH_BOOTSTRAP_URL, ANTHROPIC_OAUTH_CALLBACK_PATH, ANTHROPIC_OAUTH_CALLBACK_PORT, ANTHROPIC_OAUTH_CLIENT_ID, ANTHROPIC_OAUTH_GRANT_TTL_MS, ANTHROPIC_OAUTH_SCOPES (+33 more)

### Community 9 - "DB Map API"
Cohesion: 0.11
Nodes (32): badRequest(), createDbMapApi(), internalError(), notFound(), resolveTarget(), CountRow, DbMapPersistence, DbMapService (+24 more)

### Community 10 - "Runtime Composition"
Cohesion: 0.09
Nodes (27): createwokrouteRuntime(), formatRequestLog(), maskIp(), requestLogLevel(), routeResolver(), routingRevision, withRoutingRevisionTracking(), wokrouteRuntime (+19 more)

### Community 11 - "Auth Driver Interface"
Cohesion: 0.07
Nodes (17): AuthDriver, AuthDriverEntry, AuthDriverRegistry, MapAuthDriverRegistry, OAUTH_LOGIN_SESSION_TTL_MS, OAUTH_MAX_LOGIN_SESSIONS, OAuthLoginSessionView, OAuthSessionError (+9 more)

### Community 12 - "Input Sanitizers"
Cohesion: 0.10
Nodes (27): booleanOrUndefined(), boundedNumber(), credentialKind(), customProviderKind(), defaultProxyPort(), isProxyRelayHost(), isValidCustomApiKey(), limitOrUndefined() (+19 more)

### Community 13 - "Console Diagnostics"
Cohesion: 0.08
Nodes (23): boundedLimit(), boundedPeriod(), buildResolveTrace(), ConsoleDiagnostics, ConsoleDiagnosticsOptions, CPU_INFO, memorySnapshot(), MetricsView (+15 more)

### Community 14 - "Config Backup & Restore"
Cohesion: 0.09
Nodes (35): applyConfigRestore(), assertBackupTable(), BACKUP_APP, BACKUP_TABLES, BACKUP_VERSION, BackupTable, DELETE_ORDER, exportConfigBackup() (+27 more)

### Community 15 - "Quota Fetchers"
Cohesion: 0.14
Nodes (36): anthropic(), antigravity(), authCredential(), clampPercent(), cleanError(), cline(), codex(), FetchLike (+28 more)

### Community 16 - "Request History Repository"
Cohesion: 0.07
Nodes (9): RequestHistoryFilters, RuntimeMetadataRepository, UsageDimension, UsagePeriod, ChartBucket, ModelTokenTotalsRow, RuntimeMetadataRepository, UsageByRow (+1 more)

### Community 17 - "Routing Policy & Backoff"
Cohesion: 0.06
Nodes (32): RouteStatus, RoutingPreset, ACCOUNT_AUTH_BACKOFF_BASE_MS, ACCOUNT_AUTH_BACKOFF_CAP_MS, ACCOUNT_BACKOFF_POLICY, ACCOUNT_QUOTA_COOLDOWN_MS, ACCOUNT_QUOTA_POLICY, ACCOUNT_RATE_LIMIT_COOLDOWN_MS (+24 more)

### Community 18 - "Credential Selection"
Cohesion: 0.08
Nodes (23): AccountHealthOptions, CredentialSelectionReason, CredentialSelectionResult, CredentialSelectionStrategy, CredentialSelector, isAccountEligible(), MemoryOAuthTokenStore, OAUTH_SAFETY_SKEW_MS (+15 more)

### Community 19 - "Anthropic Message Normalization"
Cohesion: 0.10
Nodes (32): ImageReference, NormalizedProviderRequest, NormalizedTool, ReasoningConfig, ReasoningEffort, ReasoningSummary, toAnthropicImageSource(), toAnthropicMessage() (+24 more)

### Community 20 - "Route Transitions"
Cohesion: 0.10
Nodes (25): AccountConfig, MemoryRouteTransitionStore, AccountView, AccountCreateInput, AccountRowView, AccountUpdateInput, ActiveAccountCredential, ApiKeyCreateInput (+17 more)

### Community 21 - "Account Recovery Sweep"
Cohesion: 0.09
Nodes (8): AccountRecoverySweep, AccountRecoverySweepOptions, AccountHealthManager, AccountHealthRecord, MemoryModelLockStore, ModelLockStore, ModelLockRecord, accountCooldownPolicyFor()

### Community 22 - "OAuth Callback Server"
Cohesion: 0.10
Nodes (16): CallbackEndpoint, callbackEndpointFor(), CallbackServer, CallbackServerEntry, defaultRedirectUriForProvider(), ensureCallbackServer(), log(), OnComplete (+8 more)

### Community 23 - "CLI & Autostart"
Cohesion: 0.16
Nodes (30): backgroundWithAutostart(), dispatch(), installAutostart(), installLaunchd(), installSystemd(), installWindows(), interactiveMenu(), launchdPlist() (+22 more)

### Community 24 - "fs-ops Helper Library"
Cohesion: 0.16
Nodes (23): checkBinaryInstalled(), envGet(), envRemove(), envUpsert(), escapeRegex(), fileExists(), keyPrefix(), readTextFile() (+15 more)

### Community 25 - "AgentRouter Adapter"
Cohesion: 0.11
Nodes (9): ContextStats, TokenCountInput, AGENTROUTER_FALLBACK_CAPABILITIES, AGENTROUTER_MODELS, AGENTROUTER_SURFACES, agentRouterModelCatalog, BODY_FIELD_ORDER, buildHeaders() (+1 more)

### Community 26 - "Qoder Provider Adapter"
Cohesion: 0.09
Nodes (31): isTerminalEvent(), StopReason, buildCosyHeaders(), buildQoderRequest(), callQoder(), decodeQoderStream(), encodeQoderBody(), flattenContent() (+23 more)

### Community 27 - "Model Metadata"
Cohesion: 0.11
Nodes (28): ModelCapabilityCategory, ModelContextLimits, ModelTokenPricing, CATEGORY_ORDER, ModelMetadataLookup, ResolvedModelMetadata, resolveModelMetadata(), affinityKeyString() (+20 more)

### Community 28 - "Console API Router"
Cohesion: 0.14
Nodes (28): badRequest(), conflict(), consoleLogStream(), ConsoleRouterDependencies, createConsoleApi(), liveTrafficSnapshot(), liveTrafficStream(), makeSessionGuard() (+20 more)

### Community 29 - "Provider Service"
Cohesion: 0.08
Nodes (7): sanitizeProviderRoutingPatch(), ProviderService, CustomProviderRepository, CustomProviderView, ProviderConfigRepository, ProviderConfigView, ProviderRoutingSettings

### Community 30 - "IP Bans & Route Health"
Cohesion: 0.07
Nodes (9): IpBanRepository, RouteHealthStore, RestoreResult, RestoreValidation, ConfigPersistence, AliasRepository, ComboRepository, ProviderModelRepository (+1 more)

### Community 31 - "Claude Injector"
Cohesion: 0.11
Nodes (18): ensureDir(), ensureV1Suffix(), readJsonFile(), writeJsonFile(), claudeInjector, buildEntry(), CopilotEntry, copilotInjector (+10 more)

### Community 32 - "CLI Tools Registry"
Cohesion: 0.12
Nodes (20): INJECTORS, getToolDef(), TOOL_IDS, TOOL_REGISTRY, ToolId, CliToolService, injectorFor(), sanitizeStatus() (+12 more)

### Community 33 - "Stream Recovery Lifecycle"
Cohesion: 0.14
Nodes (21): clientAbortedCallError(), createStreamLifecycle(), internalCallError(), isMeaningfulEvent(), isProviderCallError(), recoverableEvents(), RecoverableEventsOptions, recoverCall() (+13 more)

### Community 34 - "Auth Service"
Cohesion: 0.10
Nodes (10): NineRouterConversion, AuthService, BackupService, hashConsolePassword(), LoginLimiter, verifyConsolePassword(), BackupActionResult, BackupRepository (+2 more)

### Community 35 - "OAuth Token Refresh"
Cohesion: 0.12
Nodes (12): OAuthRefresher, OAuthTokenRecord, OAuthTokenStore, DriverAwareRefresherOptions, CreateConsoleServicesOptions, oauthCredentialBundle(), oauthRefreshErrorView(), OAuthService (+4 more)

### Community 36 - "Protocol Body Parsing"
Cohesion: 0.11
Nodes (24): BigIntRange, decoder, JsonBodyResult, classifyDataUrl(), classifyHttpUrl(), classifyImageReference(), embeddedIpv4(), fail() (+16 more)

### Community 37 - "Kiro Provider Adapter"
Cohesion: 0.11
Nodes (25): buildKiroPayload(), buildThinkingSystemPrefix(), decodeKiroStream(), DEFAULT_PROFILE_ARNS, defaultProfileArn(), ENDPOINTS, eventContent(), KIRO_FALLBACK_CAPABILITIES (+17 more)

### Community 38 - "Custom Provider Discovery"
Cohesion: 0.09
Nodes (19): sanitizeRuntimePatch(), CustomProviderMutationError, discoverProviderModels(), extractAccessToken(), extractModelIds(), MODEL_ENDPOINTS, OAuthAccountStatusView, OAuthCompleteResultView (+11 more)

### Community 39 - "Redirect Policy & Hostname"
Cohesion: 0.12
Nodes (23): isIpLiteral(), isIpv4Literal(), isPrivateUseName(), normalizeHostname(), fetchWithRedirectPolicy(), MAX_REDIRECTS, RedirectFollowOptions, RedirectHopValidator (+15 more)

### Community 40 - "OAuth PKCE Utilities"
Cohesion: 0.12
Nodes (19): OAuthRefreshResult, base64Decode(), bytesToBase64Url(), createPkce(), decodeJwtPayload(), nonEmpty(), OAUTH_REFRESH_SKEW_MS, OAUTH_STATE_TTL_MS (+11 more)

### Community 41 - "Console Session Guard"
Cohesion: 0.11
Nodes (21): base64UrlDecode(), base64UrlEncode(), decoder, encoder, guardConsoleRequest(), GuardVerdict, hmacKey(), isSameOriginRequest() (+13 more)

### Community 42 - "Warp API & Pool"
Cohesion: 0.18
Nodes (10): badRequest(), createWarpApi(), notFound(), WarpApiMount, WarpPoolService, WarpAccountInput, WarpAccountView, WarpImportInput (+2 more)

### Community 43 - "Account Service"
Cohesion: 0.09
Nodes (5): AccountService, AccountListOptions, AccountListResult, AccountRepository, loadRouteTransition()

### Community 44 - "Model Probe"
Cohesion: 0.17
Nodes (21): credentialUnavailableError(), collectStreamSample(), DEFAULT_PROBE_LIMITS, extractNonStreamSample(), failure(), isProviderCallError(), ModelProbeLimits, ProbeCredentialMode (+13 more)

### Community 45 - "Model Studio Sessions"
Cohesion: 0.15
Nodes (23): boundedText(), boundStudioMessage(), createStudioSession(), encoder, evictExpired(), isStudioMessage(), listStudioSessions(), measureSession() (+15 more)

### Community 46 - "Console Wiring"
Cohesion: 0.14
Nodes (20): quotaViewFromState(), createConsoleRepositories(), DEFAULT_FILTER_RULES, ensureBootstrapProxyKey(), listOrNull(), makeAccountRepository(), makeBackupRepository(), makeCustomProviderRepository() (+12 more)

### Community 47 - "Request Tracing"
Cohesion: 0.15
Nodes (15): createChildSpanContext(), createRequestTrace(), createTraceContext(), extractTraceContext(), formatTraceParent(), generateSpanId(), generateTraceId(), injectTraceContext() (+7 more)

### Community 48 - "Quota State Store"
Cohesion: 0.12
Nodes (5): accountCandidates(), MemoryQuotaStateStore, QuotaCoordinator, QuotaStateStore, deriveRouteHealth()

### Community 49 - "Cline OAuth Device Flow"
Cohesion: 0.11
Nodes (16): CLINE_API_BASE_URL, CLINE_DEFAULT_TIMEOUT_MS, CLINE_DEVICE_AUTHORIZATION_PATH, CLINE_DEVICE_DEFAULT_EXPIRES_IN_SECONDS, CLINE_DEVICE_DEFAULT_INTERVAL_SECONDS, CLINE_DEVICE_GRANT_TYPE, CLINE_MAX_DEVICE_SESSIONS, CLINE_REFRESH_PATH (+8 more)

### Community 50 - "Native Binary Resolution"
Cohesion: 0.13
Nodes (18): NativeBinContext, NativeBinName, OVERRIDE_ENV, PACKAGE_ROOT, resolveNativeBin(), resolveWgcfBin(), resolveWireProxyBin(), WarpBinaryError (+10 more)

### Community 51 - "Proxy Request Planning"
Cohesion: 0.15
Nodes (18): AuthorizedProxyRequestInput, BLACKBOX_FORCE_RESPONSES_MODELS, DEFAULT_LIMITS, ProxyRequestDependencies, ProxyRequestLogEvent, ProxyRoutePlan, RouteAttemptSelection, telemetryStart() (+10 more)

### Community 52 - "Admission Control"
Cohesion: 0.14
Nodes (14): ProxyAuthorization, ApiKeyPublic, admissionError(), AdmissionLease, AdmissionUsage, ApiKeyAdmission, ApiKeyAdmissionErrorShape, approximateByteLength() (+6 more)

### Community 53 - "Proxy Repository"
Cohesion: 0.11
Nodes (4): ProxyRepository, ProxySettingsRepository, RouteHealth, HealthRepository

### Community 54 - "Proxy Edge Entrypoint"
Cohesion: 0.13
Nodes (15): ProxyEndpoint, readBoundedJson(), aclCache, aclFor(), bannedIpsCache, CachedAcl, CatalogCache, errorResponse() (+7 more)

### Community 55 - "Anthropic OAuth Driver"
Cohesion: 0.14
Nodes (7): OAuthStartInput, AnthropicOAuthDriver, identityFromTokenResponse(), nonEmpty(), nonEmptyName(), AuthorizationCodeDriver, CodexOAuthDriver

### Community 56 - "Freebuff Provider Adapter"
Cohesion: 0.14
Nodes (18): extractAccessTokenOrRaw(), NetworkSelection, ensureSession(), FREE_ROOT_AGENT_BY_MODEL, FREEBUFF_FALLBACK_CAPABILITIES, FREEBUFF_MODELS, FREEBUFF_ROOT_SYSTEM_OPENINGS, FREEBUFF_SURFACES (+10 more)

### Community 57 - "OAuth Coordinator"
Cohesion: 0.16
Nodes (4): CredentialConfigStore, OAuthCoordinator, OAuthKeepalive, OAuthKeepaliveOptions

### Community 58 - "Kiro OAuth Driver"
Cohesion: 0.25
Nodes (3): KiroOAuthDriver, numberField(), stringField()

### Community 59 - "Warp Pool Service"
Cohesion: 0.17
Nodes (14): createProxyPoolInjector(), WarpAllStatusesResult, checkWireProxyHealth(), getHealthAgent(), bandwidthDelta(), clearProcessMetrics(), prevNetworkBytes, ProcessMetrics (+6 more)

### Community 60 - "Grok Build OAuth Constants"
Cohesion: 0.12
Nodes (13): GROK_BUILD_CLIENT_ID, GROK_BUILD_DEVICE_CODE_URL, GROK_BUILD_DEVICE_DEFAULT_EXPIRES_IN_SECONDS, GROK_BUILD_DEVICE_DEFAULT_INTERVAL_SECONDS, GROK_BUILD_MAX_DEVICE_SESSIONS, GROK_BUILD_REFERRER, GROK_BUILD_REFRESH_LEAD_MS, GROK_BUILD_SCOPE (+5 more)

### Community 61 - "Traffic Limits"
Cohesion: 0.15
Nodes (6): runtimeMemoryLimits, activePerIpFlights, IpFlight, PerIpFlightHandle, resolveMaxTrackedIps(), SlidingWindowRateLimiter

### Community 62 - "API Key Service"
Cohesion: 0.12
Nodes (3): ApiKeyService, ApiKeyRepository, ApiKeyView

### Community 63 - "Filter Rule Service"
Cohesion: 0.17
Nodes (6): AuthActionResult, FilterRuleService, LoginResult, ConsoleErrorCode, FilterRuleRepository, FilterRuleView

### Community 64 - "Routing Config Service"
Cohesion: 0.17
Nodes (4): RoutingConfigService, AliasView, ComboView, RoutingConfigRepository

### Community 65 - "GitHub Copilot Adapter"
Cohesion: 0.18
Nodes (8): GITHUB_COPILOT_DEFAULT_MODELS, GITHUB_COPILOT_FALLBACK_CAPABILITIES, GITHUB_COPILOT_SURFACES, GitHubCopilotAdapterConfig, githubCopilotModelCatalog, AbortCoordinator, decodeSseEvents(), mapStreamAbortError()

### Community 66 - "Proxy Request Execution"
Cohesion: 0.18
Nodes (12): get(), runProxyRequest(), selectWireSurface(), detectClient(), beginProviderInFlight(), decrementInFlight(), endProviderInFlight(), incrementInFlight() (+4 more)

### Community 67 - "Console Log Stream Hub"
Cohesion: 0.17
Nodes (7): ConsoleLogStreamHub, ConsoleLogStreamSource, createConsoleLogStreamHub(), LogStreamClient, STREAM_LIMITS, wireLine(), ConsoleLogRow

### Community 68 - "Response Writer"
Cohesion: 0.18
Nodes (13): appendTerminalError(), AppendTerminalErrorOptions, createResponseWriter(), NonStreamOutput, StreamOutput, terminalErrorEvent(), writeErrorResponse(), writeNonStreamResponse() (+5 more)

### Community 69 - "OAuth HTTP Client"
Cohesion: 0.24
Nodes (5): OAuthHttpClient, parseJsonRecord(), exchangeForCopilotToken(), GitHubCopilotOAuthDriver, parseGitHubTokenResponse()

### Community 70 - "Proxy Health Manager"
Cohesion: 0.18
Nodes (4): isRecordUsable(), proxyCooldownPolicyFor(), ProxyHealthManager, ProxyHealthStore

### Community 71 - "Prompt Cache Planner"
Cohesion: 0.23
Nodes (12): applyCachePlan(), boundJsonStringify(), buildCachePlan(), CachePlan, CacheSection, CacheSectionKind, fnv1a64(), insertionIndex() (+4 more)

### Community 72 - "Message Content Normalization"
Cohesion: 0.19
Nodes (13): RequestLimits, applyLastUserCacheControl(), isRecord(), NormalizeInput, NormalizeResult, normalizeImageUrl(), normalizeInputImage(), normalizeMessageContent() (+5 more)

### Community 73 - "CommandCode Adapter"
Cohesion: 0.22
Nodes (13): buildCommandCodeRequest(), COMMANDCODE_FALLBACK_CAPABILITIES, COMMANDCODE_MODELS, COMMANDCODE_SURFACES, commandCodeHeaders(), convertMessages(), decodeCommandCodeLine(), decodeCommandCodeNdjson() (+5 more)

### Community 74 - "Surface Stream Encoders"
Cohesion: 0.31
Nodes (13): anthropicStop(), encodeAnthropic(), encodeOpenAIChat(), encoder, encodeResponses(), encodeSurfaceStream(), frame(), openAIStop() (+5 more)

### Community 75 - "Warp Types & Export"
Cohesion: 0.19
Nodes (9): maskSecret(), toWarpAccountView(), WarpAccount, WarpAccountCreateData, WarpAccountUpdateData, WarpBackupImport, WarpBackupPayload, WarpInstanceStatus (+1 more)

### Community 76 - "Protocol Translation"
Cohesion: 0.47
Nodes (12): ProviderProtocol, jsonObject(), narrowList(), narrowRecord(), narrowText(), nullableNumber(), anthropicToChat(), chatToAnthropic() (+4 more)

### Community 77 - "Rate Limit Handling"
Cohesion: 0.23
Nodes (12): calculateRateLimitBackoffMs(), isOpaqueStatusBody(), isUsageLimitOutcome(), isUsageLimitStatus(), matchesUsageLimitText(), parseRateLimitReason(), RateLimitReason, mapUpstreamError() (+4 more)

### Community 78 - "Token Saver"
Cohesion: 0.27
Nodes (12): applyTokenSaver(), dedupLog(), generic(), gitDiff(), gitStatus(), grep(), QUALITY_LIMITS, readNumbered() (+4 more)

### Community 80 - "Proxy Pool"
Cohesion: 0.19
Nodes (3): ProxyPool, ProxySlotManager, stableHash()

### Community 81 - "Antigravity OAuth Driver"
Cohesion: 0.20
Nodes (4): AntigravityOAuthDriver, asRecord(), defaultTierId(), readProjectId()

### Community 83 - "Cline Provider Adapter"
Cohesion: 0.20
Nodes (9): accessTokenFromCredential(), CLINE_FALLBACK_CAPABILITIES, CLINE_MODELS, CLINE_SURFACES, clineBearer(), clineHeaders(), CLINEPASS_MODELS, clinePassModelCatalog (+1 more)

### Community 84 - "Model Service"
Cohesion: 0.29
Nodes (4): ModelService, ModelView, SettingsView, ModelMetadata

### Community 86 - "Cline Injector"
Cohesion: 0.27
Nodes (9): isLocalEndpoint(), stripV1Suffix(), ClineGlobalState, clineInjector, ClineSecrets, dataDir(), globalStatePath(), isConfigured() (+1 more)

### Community 87 - "Injector Guide"
Cohesion: 0.31
Nodes (8): codexInjector, deepseekTuiInjector, ampInjector, continueInjector, cursorInjector, qwenInjector, rooInjector, jcodeInjector

### Community 88 - "Kilo Injector"
Cohesion: 0.22
Nodes (4): authPath(), dataDir(), kiloInjector, ToolInjector

### Community 89 - "Console Static Serving"
Cohesion: 0.27
Nodes (9): applySecurityHeaders(), CONSOLE_ROOT, ConsoleStaticResolution, decodeConsolePath(), isUnsafePath(), resolveConsoleStatic(), isTerminalUpgradeRequest(), didUseDefaultPassword() (+1 more)

### Community 90 - "Terminal WebSocket"
Cohesion: 0.22
Nodes (9): BLOCKED_PATTERNS, executeCommand(), send(), TerminalMessage, TerminalResponse, TerminalSession, terminalWebSocket, TerminalWsData (+1 more)

### Community 91 - "WGCF Account Registration"
Cohesion: 0.29
Nodes (8): parseAccountToml(), parseImportedProfile(), parseWireGuardConf(), registerWarpAccount(), runCmd(), WgcfAccount, WgcfProfile, WgcfRegisterResult

### Community 94 - "Hermes Injector"
Cohesion: 0.28
Nodes (4): configPath(), envPath(), hermesDir(), hermesInjector

### Community 95 - "9Router Backup Import"
Cohesion: 0.36
Nodes (8): convert9RouterBackup(), model(), NineRouterImportReport, nowDate(), PROVIDER_MAP, Row, rows(), text()

### Community 96 - "Observability Metrics"
Cohesion: 0.33
Nodes (7): Counter, Gauge, Histogram, MetricLabels, MetricNames, metrics, toPrometheus()

### Community 97 - "Exa Search Adapter"
Cohesion: 0.22
Nodes (8): EXA_FALLBACK_CAPABILITIES, EXA_MODELS, EXA_SURFACES, exaModelCatalog, ExaSearchRequest, ExaSearchResponse, ExaSearchResult, ExaStreamChunk

### Community 99 - "Proxy Fetchers"
Cohesion: 0.28
Nodes (8): buildProxyFetcher(), headersToObject(), httpProxyFetcher(), normalizeBody(), proxyUrlOf(), relayFetcher(), socks5Fetcher(), socksAgentFor()

### Community 101 - "Runtime Settings"
Cohesion: 0.43
Nodes (7): requestPrivacyMode(), normalizeSidebarIconDataUrl(), runtimeRecord(), runtimeRecordFromJson(), runtimeSettings(), makeSettingsRepository(), proxyRuntimeSettings()

### Community 102 - "OpenCode Injector"
Cohesion: 0.29
Nodes (4): OpencodeConfig, opencodeInjector, OpencodeModel, OpencodeProvider

### Community 105 - "Error Types"
Cohesion: 0.38
Nodes (4): ApplicationErrorKind, ProtocolCodecError, StreamDecodeKind, ProviderAdapterErrorOptions

### Community 106 - "Injector Contract Spec"
Cohesion: 0.48
Nodes (7): CLI Tools Injector Contract, ApplyInput Shape, fs-ops Helper Catalog, Nine Injector Implementation Rules, ToolInjector Interface, ToolStatus Shape, wokroute Provider Naming Rule

### Community 111 - "Route ACL"
Cohesion: 0.70
Nodes (4): allowedByList(), isRouteAllowed(), matches(), RouteAcl

## Knowledge Gaps
- **438 isolated node(s):** `routingRevision`, `AccountRecoverySweepOptions`, `RouteAttemptSelection`, `DEFAULT_LIMITS`, `BLACKBOX_FORCE_RESPONSES_MODELS` (+433 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TokenSet` connect `OAuth Contracts` to `OAuth HTTP Client`, `Custom Provider Discovery`, `Anthropic OAuth Constants`, `OAuth PKCE Utilities`, `Auth Driver Interface`, `Antigravity OAuth Driver`, `Cline OAuth Device Flow`, `OAuth Callback Server`, `Anthropic OAuth Driver`, `Kiro OAuth Driver`, `Grok Build OAuth Constants`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `sanitizeMessage()` connect `Stream Recovery Lifecycle` to `Provider Adapter Abstractions`, `Provider Request/Stream Pipeline`, `Provider Adapter Implementations`, `Runtime Utilities & Telemetry`, `Domain Contracts`, `Repository Layer & Rows`, `Request Normalization`, `DB Map API`, `Input Sanitizers`, `Routing Policy & Backoff`, `Credential Selection`, `Account Recovery Sweep`, `Auth Service`, `OAuth Token Refresh`, `Protocol Body Parsing`, `Custom Provider Discovery`, `Model Probe`, `Proxy Request Planning`, `GitHub Copilot Adapter`, `Proxy Health Manager`, `Error Types`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `AccountRepository` connect `Account Service` to `OAuth Token Refresh`, `Custom Provider Discovery`, `Console Wiring`, `Route Transitions`, `Proxy Repository`, `Provider Service`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `routingRevision`, `AccountRecoverySweepOptions`, `RouteAttemptSelection` to the rest of the system?**
  _438 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Provider Adapter Abstractions` be split into smaller, more focused modules?**
  _Cohesion score 0.052922139729678276 - nodes in this community are weakly interconnected._
- **Should `Provider Request/Stream Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.07377208309066201 - nodes in this community are weakly interconnected._
- **Should `Provider Adapter Implementations` be split into smaller, more focused modules?**
  _Cohesion score 0.04963427377220481 - nodes in this community are weakly interconnected._