import * as z from "zod/v4";

export const ReturnModeSchema = z.enum(["paths", "base64"]);
export type ReturnMode = z.infer<typeof ReturnModeSchema>;

export const BackendNameSchema = z.enum(["vibium", "playwright", "extension"]);
export type BackendName = z.infer<typeof BackendNameSchema>;

export const BrowserActionNameSchema = z.enum([
  "openSession",
  "getSessionStatus",
  "navigateHome",
  "startNewChat",
  "searchGpts",
  "selectGpt",
  "submitPrompt",
  "waitForImages",
  "downloadImage",
]);
export type BrowserActionName = z.infer<typeof BrowserActionNameSchema>;

export interface BackendUsageEntry {
  action: BrowserActionName;
  backend: BackendName;
  attemptedBackends: BackendName[];
  fellBack: boolean;
  timestamp: string;
}

export interface GptCandidate {
  id?: string;
  name: string;
  description?: string;
}

export interface RankedGptCandidate extends GptCandidate {
  normalizedName: string;
  score: number;
}

export interface GptResolutionResult {
  status: "resolved" | "ambiguous" | "not_found";
  query: string;
  matches: RankedGptCandidate[];
  resolved?: RankedGptCandidate;
}

export interface BrowserSessionConfig {
  baseUrl: string;
}

export interface BrowserSessionStatus {
  authenticated: boolean;
  currentUrl?: string;
  details?: string;
}

export interface ChatGptTabContext extends BrowserSessionStatus {
  pageType: "chat" | "gpt" | "login" | "challenge" | "unknown";
  pageTitle?: string;
  gpt?: {
    name?: string;
    slug?: string;
  };
}

export interface GeneratedImageHandle {
  id?: string;
  mimeType?: string;
  fileName?: string;
  base64Data?: string;
  sourceUrl?: string;
}

export interface DownloadedImage {
  fileName?: string;
  mimeType: string;
  base64Data: string;
}

export interface BridgeGeneratedImage extends DownloadedImage {
  sourceUrl?: string;
}

export interface ArtifactImageRecord {
  index: number;
  fileName: string;
  filePath: string;
  mimeType: string;
  byteLength: number;
}

export interface ArtifactMetadata {
  runId: string;
  prompt: string;
  gptInput?: string;
  resolvedGpt?: string;
  status: "succeeded" | "failed";
  createdAt: string;
  completedAt: string;
  artifactDirectory: string;
  metadataPath: string;
  backendUsage: BackendUsageEntry[];
  images: ArtifactImageRecord[];
}

export interface PersistedRun {
  metadata: ArtifactMetadata;
  images: ArtifactImageRecord[];
  imagePayloads: DownloadedImage[];
}

export interface GenerationWorkflowResult {
  prompt: string;
  gptInput?: string;
  resolvedGpt?: string;
  images: DownloadedImage[];
  backendUsage: BackendUsageEntry[];
}

export interface RuntimePaths {
  cwd: string;
  artifactRoot: string;
}

export interface RetryConfig {
  attempts: number;
  baseDelayMs: number;
}

export interface TimeoutConfig {
  defaultTimeoutMs: number;
  maxTimeoutMs: number;
}

export interface BrowserRuntimeConfig {
  headless: boolean;
}

export interface BrowserLaunchConfig {
  automationProfilePath?: string;
  cloneAutomationProfile: boolean;
  chromeProfileDirectory?: string;
  chromeExecutablePath?: string;
}

export interface AppConfig {
  chatGptBaseUrl: string;
  returnMode: ReturnMode;
  paths: RuntimePaths;
  retry: RetryConfig;
  timeouts: TimeoutConfig;
  browser: BrowserRuntimeConfig;
  browserLaunch: BrowserLaunchConfig;
  extensionBridge: ExtensionBridgeConfig;
}

export interface ExtensionBridgeConfig {
  host: string;
  port: number;
}

export interface SessionBootstrapDiagnostic {
  status: "ready" | "needs_configuration";
  messages: string[];
  checklist: string[];
}

export interface ExtensionTabSession {
  sessionId: string;
  tabKey: string;
  currentUrl: string;
  pageType: ChatGptTabContext["pageType"];
  pageTitle?: string;
  gptName?: string;
  authenticated?: boolean;
  details?: string;
  connectedAt: string;
  lastSeenAt: string;
  selected: boolean;
}

export interface GenerationResponseImage {
  index: number;
  fileName: string;
  filePath: string;
  mimeType: string;
  embeddedBase64?: string;
  embeddingError?: string;
}

export interface GenerationResponsePayload {
  success: boolean;
  prompt: string;
  gptInput?: string;
  resolvedGpt?: string;
  returnMode: ReturnMode;
  artifactDirectory: string;
  metadataPath: string;
  backendUsage: BackendUsageEntry[];
  images: GenerationResponseImage[];
  warnings: string[];
}

export interface ErrorResponsePayload {
  success: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    causeSummary?: string;
    details?: unknown;
  };
}

export const SelectChatGptTabInputSchema = {
  tabKey: z.string().trim().min(1).max(256),
};

export const GenerateImageNewChatInputSchema = {
  prompt: z.string().trim().min(1).max(4000),
  returnMode: ReturnModeSchema.optional(),
  timeoutMs: z.number().int().positive().max(900000).optional(),
};

export const GenerateImageActiveTabInputSchema = {
  prompt: z.string().trim().min(1).max(4000),
  returnMode: ReturnModeSchema.optional(),
  timeoutMs: z.number().int().positive().max(900000).optional(),
};

export const GenerateImageWithGptInputSchema = {
  gptName: z.string().trim().min(1).max(256),
  prompt: z.string().trim().min(1).max(4000),
  returnMode: ReturnModeSchema.optional(),
  timeoutMs: z.number().int().positive().max(900000).optional(),
};

export const ListMatchingGptsInputSchema = {
  query: z.string().trim().min(1).max(256),
};
