import { BackendRouter } from "../browser/backendRouter.js";
import { ChatGptWorkflow } from "../browser/chatgpt.js";
import { ensureAuthenticatedBrowserSession } from "../browser/session.js";
import { AppError } from "../errors.js";
import type {
  AppConfig,
  BackendUsageEntry,
  GenerationWorkflowResult,
  ReturnMode,
} from "../types.js";
import { SessionBootstrapService } from "../services/sessionBootstrapService.js";
import { ExtensionBootstrapService } from "../services/extensionBootstrapService.js";
import { GptResolver, normalizeGptName } from "../services/gptResolver.js";
import { ImagePersistenceService } from "../services/imagePersistence.js";
import { ResultFormatter } from "../services/resultFormatter.js";
import { RunLockService } from "../services/runLock.js";
import { ExtensionBridgeServer } from "../extensionBridge/server.js";
import { ExtensionCommandRouter } from "../extensionBridge/commandRouter.js";
import { toIsoTimestamp } from "../utils/time.js";

export interface ToolHandlerDependencies {
  config: AppConfig;
  runLock: RunLockService;
  sessionBootstrap: SessionBootstrapService;
  extensionBootstrap: ExtensionBootstrapService;
  gptResolver: GptResolver;
  imagePersistence: ImagePersistenceService;
  resultFormatter: ResultFormatter;
  createRouter: () => BackendRouter;
  extensionBridge: ExtensionBridgeServer;
}

export function resolveReturnMode(
  requested: ReturnMode | undefined,
  config: AppConfig,
): ReturnMode {
  return requested ?? config.returnMode;
}

export function resolveTimeoutMs(
  requested: number | undefined,
  config: AppConfig,
): number {
  const timeout = requested ?? config.timeouts.defaultTimeoutMs;
  return Math.min(timeout, config.timeouts.maxTimeoutMs);
}

export function getLockKey(config: AppConfig): string {
  return `playwright:${config.browserLaunch.automationProfilePath ?? "managed"}:${config.browser.headless ? "headless" : "headed"}`;
}

export async function prepareWorkflow(
  dependencies: ToolHandlerDependencies,
): Promise<ChatGptWorkflow> {
  const router = dependencies.createRouter();
  await ensureAuthenticatedBrowserSession(
    router,
    dependencies.config,
    dependencies.sessionBootstrap,
  );
  return new ChatGptWorkflow(router, dependencies.gptResolver);
}

export function createExtensionCommandRouter(
  dependencies: ToolHandlerDependencies,
): ExtensionCommandRouter {
  return new ExtensionCommandRouter(dependencies.extensionBridge);
}

export async function generateImagesFromSelectedTab(
  dependencies: ToolHandlerDependencies,
  prompt: string,
  timeoutMs: number,
  options?: { startNewChat?: boolean; gptInput?: string; resolvedGpt?: string },
): Promise<GenerationWorkflowResult> {
  await dependencies.extensionBootstrap.ensureConnectedTab(dependencies.config, dependencies.extensionBridge, {
    timeoutMs: Math.min(timeoutMs, 30000),
  });

  const router = createExtensionCommandRouter(dependencies);
  const images = await router.generateImage(prompt, timeoutMs, {
    startNewChat: options?.startNewChat,
  });

  return {
    prompt,
    gptInput: options?.gptInput,
    resolvedGpt: options?.resolvedGpt,
    images: images.map((image) => ({
      fileName: image.fileName,
      mimeType: image.mimeType,
      base64Data: image.base64Data,
    })),
    backendUsage: buildExtensionUsage(options?.startNewChat === true),
  };
}

export async function assertSelectedTabMatchesRequestedGpt(
  dependencies: ToolHandlerDependencies,
  requestedGpt: string,
): Promise<string> {
  await dependencies.extensionBootstrap.ensureConnectedTab(dependencies.config, dependencies.extensionBridge, {
    timeoutMs: 30000,
  });

  const router = createExtensionCommandRouter(dependencies);
  const selected = router.getSelectedTab();
  const context = await router.validateSelectedSession();
  const currentGptName = context.gpt?.name ?? selected.gptName;

  if (context.pageType !== "gpt" || !currentGptName) {
    throw new AppError(
      "ACTIVE_TAB_MISMATCH",
      `The selected tab is not an open GPT page for '${requestedGpt}'.`,
      {
        details: {
          requestedGpt,
          currentUrl: context.currentUrl ?? selected.currentUrl,
          pageType: context.pageType,
          gptName: currentGptName,
          tabKey: selected.tabKey,
        },
      },
    );
  }

  const resolution = dependencies.gptResolver.resolve(requestedGpt, [{ name: currentGptName }]);
  if (resolution.status !== "resolved" || !resolution.resolved) {
    throw new AppError(
      "ACTIVE_TAB_MISMATCH",
      `The selected GPT tab '${currentGptName}' does not match '${requestedGpt}'.`,
      {
        details: {
          requestedGpt,
          currentGpt: currentGptName,
          normalizedRequested: normalizeGptName(requestedGpt),
          normalizedCurrent: normalizeGptName(currentGptName),
          tabKey: selected.tabKey,
          currentUrl: context.currentUrl ?? selected.currentUrl,
        },
      },
    );
  }

  return currentGptName;
}

function buildExtensionUsage(startNewChat: boolean): BackendUsageEntry[] {
  const timestamp = toIsoTimestamp();
  const attemptedBackends = ["extension"] as const;
  const usage: BackendUsageEntry[] = [];

  if (startNewChat) {
    usage.push({
      action: "startNewChat",
      backend: "extension",
      attemptedBackends: [...attemptedBackends],
      fellBack: false,
      timestamp,
    });
  }

  usage.push(
    {
      action: "submitPrompt",
      backend: "extension",
      attemptedBackends: [...attemptedBackends],
      fellBack: false,
      timestamp,
    },
    {
      action: "waitForImages",
      backend: "extension",
      attemptedBackends: [...attemptedBackends],
      fellBack: false,
      timestamp,
    },
  );

  return usage;
}
