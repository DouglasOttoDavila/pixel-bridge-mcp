import assert from "node:assert/strict";
import { SessionBootstrapService } from "../src/services/sessionBootstrapService.js";
import { ExtensionBootstrapService } from "../src/services/extensionBootstrapService.js";
import { ResultFormatter } from "../src/services/resultFormatter.js";
import { buildValidateBrowserSessionHandler } from "../src/tools/validateBrowserSession.js";
import type { AppConfig, ExtensionTabSession } from "../src/types.js";
import { ExtensionBridgeServer } from "../src/extensionBridge/server.js";

function createConfig(): AppConfig {
  return {
    chatGptBaseUrl: "https://chatgpt.com",
    returnMode: "paths",
    paths: {
      cwd: "D:/GitHub/image-generation-mcp-server",
      runtimeHome: "D:/Users/doug/AppData/Local/pixelbridge-mcp",
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

function createBridgeMock(): ExtensionBridgeServer {
  return {
    getSelectedSession() {
      return {
        sessionId: "session-1",
        tabKey: "tab-1",
        currentUrl: "https://chatgpt.com/g/g-1234",
        pageType: "gpt",
        pageTitle: "My GPT",
        gptName: "My GPT",
        authenticated: true,
        details: "ChatGPT composer is visible.",
        connectedAt: "2026-03-19T00:00:00.000Z",
        lastSeenAt: "2026-03-19T00:00:00.000Z",
        selected: true,
      };
    },
    async validateSelectedSession() {
      return {
        authenticated: true,
        currentUrl: "https://chatgpt.com/g/g-1234",
        details: "ChatGPT composer is visible.",
        pageType: "gpt",
        pageTitle: "My GPT",
        gpt: { name: "My GPT" },
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
      currentUrl: "https://chatgpt.com/g/g-1234",
      pageType: "gpt",
      pageTitle: "My GPT",
      gptName: "My GPT",
      authenticated: true,
      details: "ChatGPT composer is visible.",
      connectedAt: "2026-03-19T00:00:00.000Z",
      lastSeenAt: "2026-03-19T00:00:00.000Z",
      selected: true,
    };
  }
}

export async function runValidateBrowserSessionTests(): Promise<void> {
  const extensionBootstrap = new RecordingExtensionBootstrapService();
  const handler = buildValidateBrowserSessionHandler({
    config: createConfig(),
    runLock: {} as never,
    sessionBootstrap: new SessionBootstrapService(),
    extensionBootstrap,
    gptResolver: {} as never,
    imagePersistence: {} as never,
    resultFormatter: new ResultFormatter(),
    createRouter: () => {
      throw new Error("not used");
    },
    extensionBridge: createBridgeMock(),
  });

  const result = await handler();
  const structured = result.structuredContent as {
    success: boolean;
    authenticated: boolean;
    activeTab?: { tabKey: string };
    messages: string[];
  };

  assert.equal(result.isError, undefined);
  assert.equal(structured.success, true);
  assert.equal(structured.authenticated, true);
  assert.equal(structured.activeTab?.tabKey, "tab-1");
  assert.match(structured.messages.join(" "), /Extension bridge is ready/);
  assert.equal(extensionBootstrap.calls, 1);
}
