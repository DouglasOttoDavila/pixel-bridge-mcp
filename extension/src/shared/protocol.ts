export const BRIDGE_PROTOCOL_VERSION = 1;

export type PageType = "chat" | "gpt" | "login" | "challenge" | "unknown";
export type ClientRole = "tab" | "background";

export interface HandshakePayload {
  protocolVersion: number;
  wsUrl: string;
  token: string;
  serverVersion: string;
  expectedExtensionVersion: string;
}

export interface PageContextPayload {
  tabUrl: string;
  pageType: PageType;
  clientRole?: ClientRole;
  pageTitle?: string;
  gptName?: string;
  authenticated?: boolean;
  details?: string;
}

export interface ServerCommand {
  type: "command";
  commandId: string;
  action: "validate_session" | "generate_image" | "open_chatgpt_tab";
  payload: Record<string, unknown>;
}

export interface HelloAckMessage {
  type: "hello_ack";
  sessionId: string;
  tabKey: string;
  serverVersion: string;
  expectedExtensionVersion: string;
}

export interface GenerateImageCommandPayload {
  prompt: string;
  timeoutMs: number;
  startNewChat?: boolean;
}

export interface OpenChatGptTabCommandPayload {
  url: string;
  active?: boolean;
}

export interface BridgeGeneratedImage {
  fileName?: string;
  mimeType: string;
  base64Data: string;
  sourceUrl?: string;
}

export interface ResultMessage {
  type: "result";
  commandId: string;
  success: boolean;
  payload?: unknown;
  error?: {
    code?: string;
    message: string;
    details?: unknown;
  };
}

export function areVersionsCompatible(expected: string | undefined, actual: string | undefined): boolean {
  if (!expected || !actual) {
    return true;
  }

  return expected.trim() === actual.trim();
}
