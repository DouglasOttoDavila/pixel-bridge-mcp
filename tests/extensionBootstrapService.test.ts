import assert from "node:assert/strict";
import { ExtensionBootstrapService } from "../src/services/extensionBootstrapService.js";
import type { AppConfig, ExtensionTabSession } from "../src/types.js";
import { ExtensionBridgeServer } from "../src/extensionBridge/server.js";

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

function createSession(tabKey: string): ExtensionTabSession {
  return {
    sessionId: `session-${tabKey}`,
    tabKey,
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

export async function runExtensionBootstrapServiceTests(): Promise<void> {
  {
    let openCalls = 0;
    const bridge = {
      getSelectedSession() {
        return createSession("existing");
      },
      async openChatGptTab() {
        openCalls += 1;
      },
      listSessions() {
        return [createSession("existing")];
      },
      selectTab(tabKey: string) {
        return createSession(tabKey);
      },
    } as unknown as ExtensionBridgeServer;

    const service = new ExtensionBootstrapService();
    const selected = await service.ensureConnectedTab(createConfig(), bridge, { timeoutMs: 50 });
    assert.equal(selected.tabKey, "existing");
    assert.equal(openCalls, 0);
  }

  {
    let openCalls = 0;
    const bridge = {
      getSelectedSession() {
        return undefined;
      },
      async openChatGptTab() {
        openCalls += 1;
      },
      listSessions() {
        return openCalls > 0 ? [createSession("opened")] : [];
      },
      selectTab(tabKey: string) {
        return createSession(tabKey);
      },
    } as unknown as ExtensionBridgeServer;

    const service = new ExtensionBootstrapService();
    const selected = await service.ensureConnectedTab(createConfig(), bridge, { timeoutMs: 1200 });
    assert.equal(openCalls, 1);
    assert.equal(selected.tabKey, "opened");
  }
}
