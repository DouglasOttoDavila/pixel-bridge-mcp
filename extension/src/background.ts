import type {
  HandshakePayload,
  HelloAckMessage,
  OpenChatGptTabCommandPayload,
  ResultMessage,
  ServerCommand,
} from "./shared/protocol.js";
import { BRIDGE_PROTOCOL_VERSION, areVersionsCompatible } from "./shared/protocol.js";
import {
  buildHandshakeUrl,
  readBridgeSettings,
  writeBridgeDiagnostics,
} from "./shared/settings.js";

const COMMAND_RETRY_DELAY_MS = 3000;
const BACKGROUND_KEEPALIVE_INTERVAL_MS = 20000;
const BACKGROUND_URL = chrome.runtime.getURL("background");

let socket: WebSocket | undefined;
let connectPromise: Promise<void> | undefined;
let keepAliveInterval: number | undefined;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    bridgeEnabled: true,
    bridgeHost: "127.0.0.1",
    bridgePort: 47821,
  });
  void ensureBridgeConnection();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureBridgeConnection();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  if (changes.bridgeEnabled || changes.bridgeHost || changes.bridgePort) {
    void refreshBridgeConnection();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "refresh_bridge_connection") {
    void refreshBridgeConnection()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  }

  if (message?.type === "get_bridge_diagnostics") {
    void getPopupDiagnostics()
      .then((diagnostics) => sendResponse(diagnostics))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  }

  if (message?.type === "open_chatgpt_tab_ui") {
    void chrome.tabs.create({
      url: "https://chatgpt.com",
      active: true,
    }).then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  }

  return false;
});

void ensureBridgeConnection();

async function ensureBridgeConnection(): Promise<void> {
  const settings = await readBridgeSettings();
  const handshakeUrl = buildHandshakeUrl(settings);

  if (!settings.bridgeEnabled) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close();
    }

    await writeBridgeDiagnostics({
      connectionState: "disabled",
      handshakeUrl,
      extensionVersion: chrome.runtime.getManifest().version,
      lastError: undefined,
    });
    return;
  }

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = connect();
  try {
    await connectPromise;
  } finally {
    connectPromise = undefined;
  }
}

async function connect(): Promise<void> {
  const settings = await readBridgeSettings();
  const handshakeUrl = buildHandshakeUrl(settings);
  await writeBridgeDiagnostics({
    connectionState: "connecting",
    handshakeUrl,
    extensionVersion: chrome.runtime.getManifest().version,
    lastError: undefined,
  });

  try {
    const handshake = await fetchHandshake(settings);
    if (!areVersionsCompatible(handshake.expectedExtensionVersion, chrome.runtime.getManifest().version)) {
      await writeBridgeDiagnostics({
        connectionState: "version_mismatch",
        handshakeUrl,
        extensionVersion: chrome.runtime.getManifest().version,
        serverVersion: handshake.serverVersion,
        expectedExtensionVersion: handshake.expectedExtensionVersion,
        lastError: `Server expects extension ${handshake.expectedExtensionVersion} but installed version is ${chrome.runtime.getManifest().version}.`,
      });
      return;
    }

    const nextSocket = new WebSocket(handshake.wsUrl);

    nextSocket.addEventListener("open", () => {
      socket = nextSocket;
      nextSocket.send(JSON.stringify({
        type: "hello",
        protocolVersion: BRIDGE_PROTOCOL_VERSION,
        token: handshake.token,
        payload: buildBackgroundContext(),
      }));
      startKeepAlive();
    });

    nextSocket.addEventListener("message", (event) => {
      void handleMessage(event.data, handshake);
    });

    nextSocket.addEventListener("close", () => {
      stopKeepAlive();
      if (socket === nextSocket) {
        socket = undefined;
      }

      void writeBridgeDiagnostics({
        connectionState: "error",
        handshakeUrl,
        extensionVersion: chrome.runtime.getManifest().version,
        serverVersion: handshake.serverVersion,
        expectedExtensionVersion: handshake.expectedExtensionVersion,
      });

      setTimeout(() => {
        void ensureBridgeConnection();
      }, COMMAND_RETRY_DELAY_MS);
    });

    nextSocket.addEventListener("error", () => {
      void writeBridgeDiagnostics({
        connectionState: "error",
        handshakeUrl,
        extensionVersion: chrome.runtime.getManifest().version,
        serverVersion: handshake.serverVersion,
        expectedExtensionVersion: handshake.expectedExtensionVersion,
        lastError: "WebSocket connection to the local MCP bridge failed.",
      });
      nextSocket.close();
    });
  } catch (error) {
    await writeBridgeDiagnostics({
      connectionState: "error",
      handshakeUrl,
      extensionVersion: chrome.runtime.getManifest().version,
      lastError: error instanceof Error ? error.message : "Failed to reach the local MCP bridge.",
    });
    setTimeout(() => {
      void ensureBridgeConnection();
    }, COMMAND_RETRY_DELAY_MS + 2000);
  }
}

async function handleMessage(raw: string, handshake: HandshakePayload): Promise<void> {
  const message = JSON.parse(raw) as ServerCommand | HelloAckMessage;
  if (message.type === "hello_ack") {
    await writeBridgeDiagnostics({
      connectionState: "connected",
      handshakeUrl: buildHandshakeUrl(await readBridgeSettings()),
      extensionVersion: chrome.runtime.getManifest().version,
      serverVersion: message.serverVersion,
      expectedExtensionVersion: message.expectedExtensionVersion,
      lastConnectedAt: new Date().toISOString(),
      lastError: undefined,
    });
    return;
  }

  if (message.type !== "command") {
    return;
  }

  if (message.action === "open_chatgpt_tab") {
    try {
      const payload = parseOpenChatGptTabPayload(message.payload);
      const tab = await chrome.tabs.create({
        url: payload.url,
        active: payload.active ?? false,
      });

      return respond({
        type: "result",
        commandId: message.commandId,
        success: true,
        payload: {
          tabId: tab.id,
        },
      });
    } catch (error) {
      return respond({
        type: "result",
        commandId: message.commandId,
        success: false,
        error: {
          code: "AUTOMATION_FAILURE",
          message: error instanceof Error ? error.message : "Unknown background automation failure.",
        },
      });
    }
  }

  return respond({
    type: "result",
    commandId: message.commandId,
    success: false,
    error: {
      code: "AUTOMATION_FAILURE",
      message: `Unsupported bridge action '${message.action}'.`,
    },
  });
}

function parseOpenChatGptTabPayload(payload: Record<string, unknown>): OpenChatGptTabCommandPayload {
  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  const active = payload.active === true;

  if (!url) {
    throw new Error("A ChatGPT URL is required to open a background tab.");
  }

  return {
    url,
    active,
  };
}

function respond(message: ResultMessage): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function buildBackgroundContext() {
  return {
    tabUrl: BACKGROUND_URL,
    pageType: "unknown" as const,
    clientRole: "background" as const,
    pageTitle: "ChatGPT Extension Background",
    authenticated: false,
    details: "Extension background control connection.",
    extensionVersion: chrome.runtime.getManifest().version,
  };
}

function startKeepAlive(): void {
  stopKeepAlive();
  keepAliveInterval = self.setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "context_update",
        payload: buildBackgroundContext(),
      }));
    }
  }, BACKGROUND_KEEPALIVE_INTERVAL_MS);
}

function stopKeepAlive(): void {
  if (keepAliveInterval !== undefined) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = undefined;
  }
}

async function fetchHandshake(
  settings: Awaited<ReturnType<typeof readBridgeSettings>>,
): Promise<HandshakePayload> {
  const response = await fetch(buildHandshakeUrl(settings));
  if (!response.ok) {
    throw new Error(`Handshake failed with status ${response.status}`);
  }

  return response.json() as Promise<HandshakePayload>;
}

async function refreshBridgeConnection(): Promise<void> {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    socket.close();
  }

  socket = undefined;
  await ensureBridgeConnection();
}

async function getPopupDiagnostics(): Promise<{
  ok: true;
  diagnostics: Awaited<ReturnType<typeof readBridgeSettings>> & {
    connectionState: string;
    handshakeUrl: string;
    extensionVersion: string;
    serverVersion?: string;
    expectedExtensionVersion?: string;
    lastConnectedAt?: string;
    lastError?: string;
    openChatGptTabCount: number;
  };
}> {
  const settings = await readBridgeSettings();
  const stored = await new Promise<Record<string, unknown>>((resolve) => {
    chrome.storage.local.get(["bridgeDiagnostics"], (values) => resolve(values as Record<string, unknown>));
  });
  const diagnostics = (stored.bridgeDiagnostics as Record<string, unknown> | undefined) ?? {};
  const openTabs = await chrome.tabs.query({ url: "https://chatgpt.com/*" });

  return {
    ok: true,
    diagnostics: {
      ...settings,
      connectionState: typeof diagnostics.connectionState === "string" ? diagnostics.connectionState : "connecting",
      handshakeUrl: typeof diagnostics.handshakeUrl === "string"
        ? diagnostics.handshakeUrl
        : buildHandshakeUrl(settings),
      extensionVersion: typeof diagnostics.extensionVersion === "string"
        ? diagnostics.extensionVersion
        : chrome.runtime.getManifest().version,
      serverVersion: typeof diagnostics.serverVersion === "string" ? diagnostics.serverVersion : undefined,
      expectedExtensionVersion: typeof diagnostics.expectedExtensionVersion === "string"
        ? diagnostics.expectedExtensionVersion
        : undefined,
      lastConnectedAt: typeof diagnostics.lastConnectedAt === "string" ? diagnostics.lastConnectedAt : undefined,
      lastError: typeof diagnostics.lastError === "string" ? diagnostics.lastError : undefined,
      openChatGptTabCount: openTabs.length,
    },
  };
}
