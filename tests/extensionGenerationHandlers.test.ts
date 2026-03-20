import assert from "node:assert/strict";
import { ExtensionBridgeServer } from "../src/extensionBridge/server.js";
import { ExtensionBootstrapService } from "../src/services/extensionBootstrapService.js";
import { GptResolver } from "../src/services/gptResolver.js";
import { ResultFormatter } from "../src/services/resultFormatter.js";
import { RunLockService } from "../src/services/runLock.js";
import { SessionBootstrapService } from "../src/services/sessionBootstrapService.js";
import { buildGenerateImageActiveTabHandler } from "../src/tools/generateImageActiveTab.js";
import { buildGenerateImageNewChatHandler } from "../src/tools/generateImageNewChat.js";
import { buildGenerateImageWithGptHandler } from "../src/tools/generateImageWithGpt.js";
import type { AppConfig, ExtensionTabSession, GenerationWorkflowResult, PersistedRun } from "../src/types.js";

function createConfig(): AppConfig {
  return {
    chatGptBaseUrl: "https://chatgpt.com",
    returnMode: "paths",
    paths: {
      cwd: "D:/GitHub/image-generation-mcp-server",
      runtimeHome: "D:/Users/doug/AppData/Local/chatgpt-browser-image-generation-mcp-server",
      artifactRoot: "D:/GitHub/image-generation-mcp-server/artifacts/generated-images/chatgpt",
    },
    retry: { attempts: 3, baseDelayMs: 1000 },
    timeouts: { defaultTimeoutMs: 240000, maxTimeoutMs: 600000 },
    browser: {
      headless: false,
    },
    browserLaunch: {
      cloneAutomationProfile: true,
    },
    extensionBridge: {
      host: "127.0.0.1",
      port: 47821,
    },
  };
}

function createPersistedRun(result: GenerationWorkflowResult): PersistedRun {
  return {
    metadata: {
      runId: "run-1",
      prompt: result.prompt,
      gptInput: result.gptInput,
      resolvedGpt: result.resolvedGpt,
      status: "succeeded",
      createdAt: "2026-03-20T00:00:00.000Z",
      completedAt: "2026-03-20T00:00:01.000Z",
      artifactDirectory: "D:/artifacts/2026-03-20",
      metadataPath: "D:/artifacts/2026-03-20/run-1.metadata.json",
      backendUsage: result.backendUsage,
      images: [
        {
          index: 0,
          fileName: "image.png",
          filePath: "D:/artifacts/2026-03-20/image.png",
          mimeType: "image/png",
          byteLength: 4,
        },
      ],
    },
    images: [
      {
        index: 0,
        fileName: "image.png",
        filePath: "D:/artifacts/2026-03-20/image.png",
        mimeType: "image/png",
        byteLength: 4,
      },
    ],
    imagePayloads: result.images,
  };
}

function createBridgeMock(options?: {
  pageType?: "chat" | "gpt";
  gptName?: string;
  selectedSession?: boolean;
}): ExtensionBridgeServer {
  return {
    getSelectedSession() {
      if (options?.selectedSession === false) {
        return undefined;
      }

      return {
        sessionId: "session-1",
        tabKey: "tab-1",
        currentUrl: options?.pageType === "gpt"
          ? "https://chatgpt.com/g/g-1234-test"
          : "https://chatgpt.com/",
        pageType: options?.pageType ?? "chat",
        pageTitle: "ChatGPT",
        gptName: options?.gptName,
        authenticated: true,
        details: "ChatGPT composer is visible.",
        connectedAt: "2026-03-20T00:00:00.000Z",
        lastSeenAt: "2026-03-20T00:00:00.000Z",
        selected: true,
      };
    },
    async generateImages(_prompt: string, _timeoutMs: number) {
      return {
        images: [
          {
            fileName: "image.png",
            mimeType: "image/png",
            base64Data: Buffer.from("img").toString("base64"),
          },
        ],
      };
    },
    async validateSelectedSession() {
      return {
        authenticated: true,
        currentUrl: options?.pageType === "gpt"
          ? "https://chatgpt.com/g/g-1234-test"
          : "https://chatgpt.com/",
        details: "ChatGPT composer is visible.",
        pageType: options?.pageType ?? "chat",
        pageTitle: "ChatGPT",
        gpt: options?.gptName ? { name: options.gptName } : undefined,
      };
    },
  } as unknown as ExtensionBridgeServer;
}

class RecordingExtensionBootstrapService extends ExtensionBootstrapService {
  public calls = 0;

  public override async ensureConnectedTab(): Promise<ExtensionTabSession> {
    this.calls += 1;
    return {
      sessionId: "session-1",
      tabKey: "tab-1",
      currentUrl: "https://chatgpt.com/",
      pageType: "chat",
      pageTitle: "ChatGPT",
      authenticated: true,
      details: "ChatGPT composer is visible.",
      connectedAt: "2026-03-20T00:00:00.000Z",
      lastSeenAt: "2026-03-20T00:00:00.000Z",
      selected: true,
    };
  }
}

export async function runExtensionGenerationHandlerTests(): Promise<void> {
  {
    let captured: GenerationWorkflowResult | undefined;
    const extensionBootstrap = new RecordingExtensionBootstrapService();
    const handler = buildGenerateImageActiveTabHandler({
      config: createConfig(),
      runLock: new RunLockService(),
      sessionBootstrap: new SessionBootstrapService(),
      extensionBootstrap,
      gptResolver: new GptResolver(),
      imagePersistence: {
        async persist(_config: AppConfig, result: GenerationWorkflowResult) {
          captured = result;
          return createPersistedRun(result);
        },
      } as never,
      resultFormatter: new ResultFormatter(),
      createRouter: () => {
        throw new Error("not used");
      },
      extensionBridge: createBridgeMock({ selectedSession: false }),
    });

    const result = await handler({ prompt: "A ceramic mug" });
    assert.equal(result.isError, undefined);
    assert.equal(captured?.backendUsage[0]?.backend, "extension");
    assert.equal(captured?.backendUsage.some((entry) => entry.action === "startNewChat"), false);
    assert.equal(extensionBootstrap.calls, 1);
  }

  {
    let captured: GenerationWorkflowResult | undefined;
    const handler = buildGenerateImageNewChatHandler({
      config: createConfig(),
      runLock: new RunLockService(),
      sessionBootstrap: new SessionBootstrapService(),
      extensionBootstrap: new ExtensionBootstrapService(),
      gptResolver: new GptResolver(),
      imagePersistence: {
        async persist(_config: AppConfig, result: GenerationWorkflowResult) {
          captured = result;
          return createPersistedRun(result);
        },
      } as never,
      resultFormatter: new ResultFormatter(),
      createRouter: () => {
        throw new Error("not used");
      },
      extensionBridge: createBridgeMock(),
    });

    const result = await handler({ prompt: "A ceramic mug" });
    assert.equal(result.isError, undefined);
    assert.equal(captured?.backendUsage.some((entry) => entry.action === "startNewChat"), true);
  }

  {
    const handler = buildGenerateImageWithGptHandler({
      config: createConfig(),
      runLock: new RunLockService(),
      sessionBootstrap: new SessionBootstrapService(),
      extensionBootstrap: new ExtensionBootstrapService(),
      gptResolver: new GptResolver(),
      imagePersistence: {
        async persist(_config: AppConfig, result: GenerationWorkflowResult) {
          return createPersistedRun(result);
        },
      } as never,
      resultFormatter: new ResultFormatter(),
      createRouter: () => {
        throw new Error("not used");
      },
      extensionBridge: createBridgeMock({ pageType: "chat" }),
    });

    const result = await handler({ gptName: "Blueprint Image Generator", prompt: "A ceramic mug" });
    const structured = result.structuredContent as { error: { code: string } };
    assert.equal(result.isError, true);
    assert.equal(structured.error.code, "ACTIVE_TAB_MISMATCH");
  }

  {
    let captured: GenerationWorkflowResult | undefined;
    const handler = buildGenerateImageWithGptHandler({
      config: createConfig(),
      runLock: new RunLockService(),
      sessionBootstrap: new SessionBootstrapService(),
      extensionBootstrap: new ExtensionBootstrapService(),
      gptResolver: new GptResolver(),
      imagePersistence: {
        async persist(_config: AppConfig, result: GenerationWorkflowResult) {
          captured = result;
          return createPersistedRun(result);
        },
      } as never,
      resultFormatter: new ResultFormatter(),
      createRouter: () => {
        throw new Error("not used");
      },
      extensionBridge: createBridgeMock({
        pageType: "gpt",
        gptName: "Blueprint Image Generator",
      }),
    });

    const result = await handler({ gptName: "Blueprint Image Generator", prompt: "A ceramic mug" });
    assert.equal(result.isError, undefined);
    assert.equal(captured?.gptInput, "Blueprint Image Generator");
    assert.equal(captured?.resolvedGpt, "Blueprint Image Generator");
  }
}
