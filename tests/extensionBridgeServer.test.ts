import assert from "node:assert/strict";
import WebSocket from "ws";
import { ExtensionBridgeServer } from "../src/extensionBridge/server.js";
import type { AppConfig } from "../src/types.js";

function createConfig(port: number): AppConfig {
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
      port,
    },
  };
}

function waitForEvent<T>(target: WebSocket, event: "open" | "close" | "message"): Promise<T> {
  return new Promise((resolve) => {
    target.once(event, (value) => resolve(value as T));
  });
}

export async function runExtensionBridgeServerTests(): Promise<void> {
  {
    const port = 48000 + Math.floor(Math.random() * 1000);
    const bridge = new ExtensionBridgeServer(createConfig(port), "test-token");
    await bridge.start();

    const client = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    try {
      await waitForEvent(client, "open");
      client.send(JSON.stringify({
        type: "hello",
        protocolVersion: 1,
        token: "test-token",
        payload: {
          tabUrl: "https://chatgpt.com/",
          pageType: "chat",
          authenticated: true,
          extensionVersion: "0.1.0",
        },
      }));

      const ack = JSON.parse((await waitForEvent<Buffer>(client, "message")).toString("utf8")) as {
        type: string;
        serverVersion?: string;
        expectedExtensionVersion?: string;
      };
      assert.equal(ack.type, "hello_ack");
      assert.equal(typeof ack.serverVersion, "string");
      assert.equal(typeof ack.expectedExtensionVersion, "string");
      assert.equal(bridge.listSessions().length, 1);

      await Promise.race([
        bridge.close(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Bridge close timed out with an active websocket client.")), 1500);
        }),
      ]);

      await waitForEvent(client, "close");
    } finally {
      if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
        client.terminate();
      }

      await bridge.close();
    }
  }

  {
    const port = 49000 + Math.floor(Math.random() * 1000);
    const bridge = new ExtensionBridgeServer(createConfig(port), "test-token");
    await bridge.start();

    const client = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    try {
      await waitForEvent(client, "open");
      client.send(JSON.stringify({
        type: "hello",
        protocolVersion: 1,
        token: "test-token",
        payload: {
          tabUrl: "https://chatgpt.com/",
          pageType: "chat",
          authenticated: true,
          extensionVersion: "0.0.1",
        },
      }));

      await new Promise<void>((resolve, reject) => {
        client.once("close", () => resolve());
        setTimeout(() => reject(new Error("Version-mismatched extension connection was not closed.")), 1500);
      });

      assert.equal(bridge.listSessions().length, 0);
    } finally {
      if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
        client.terminate();
      }

      await bridge.close();
    }
  }
}
