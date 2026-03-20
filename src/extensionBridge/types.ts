import type WebSocket from "ws";
import type { ChatGptTabContext, ExtensionTabSession } from "../types.js";

export interface HelloPayload {
  tabUrl: string;
  pageType: ChatGptTabContext["pageType"];
  clientRole?: "tab" | "background";
  pageTitle?: string;
  gptName?: string;
  authenticated?: boolean;
  details?: string;
  extensionVersion?: string;
}

export interface RegisteredExtensionSession extends ExtensionTabSession {
  socket: WebSocket;
}

export interface PendingCommand {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}
