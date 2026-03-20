import type {
  HandshakePayload,
  OpenChatGptTabCommandPayload,
  ResultMessage,
  ServerCommand,
} from "./shared/protocol.js";
import { BRIDGE_PROTOCOL_VERSION } from "./shared/protocol.js";

const COMMAND_RETRY_DELAY_MS = 3000;
const BACKGROUND_KEEPALIVE_INTERVAL_MS = 20000;
const BACKGROUND_URL = chrome.runtime.getURL("background");

let socket: WebSocket | undefined;
let connectPromise: Promise<void> | undefined;
let keepAliveInterval: number | undefined;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    bridgeEnabled: true,
  });
  void ensureBridgeConnection();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureBridgeConnection();
});

void ensureBridgeConnection();

async function ensureBridgeConnection(): Promise<void> {
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
  const enabled = await readBridgeEnabled();
  if (!enabled) {
    return;
  }

  try {
    const handshake = await fetchHandshake();
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
      void handleMessage(event.data);
    });

    nextSocket.addEventListener("close", () => {
      stopKeepAlive();
      if (socket === nextSocket) {
        socket = undefined;
      }

      setTimeout(() => {
        void ensureBridgeConnection();
      }, COMMAND_RETRY_DELAY_MS);
    });

    nextSocket.addEventListener("error", () => {
      nextSocket.close();
    });
  } catch {
    setTimeout(() => {
      void ensureBridgeConnection();
    }, COMMAND_RETRY_DELAY_MS + 2000);
  }
}

async function handleMessage(raw: string): Promise<void> {
  const message = JSON.parse(raw) as ServerCommand;
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

async function fetchHandshake(): Promise<HandshakePayload> {
  const response = await fetch("http://127.0.0.1:47821/handshake");
  if (!response.ok) {
    throw new Error(`Handshake failed with status ${response.status}`);
  }

  return response.json() as Promise<HandshakePayload>;
}

async function readBridgeEnabled(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    chrome.storage.local.get(["bridgeEnabled"], (values) => {
      resolve(values.bridgeEnabled !== false);
    });
  });
}
