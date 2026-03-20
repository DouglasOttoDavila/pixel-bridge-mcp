import * as z from "zod/v4";
import type { BridgeGeneratedImage, ChatGptTabContext } from "../types.js";

export const BRIDGE_PROTOCOL_VERSION = 1;

const PageTypeSchema = z.enum(["chat", "gpt", "login", "challenge", "unknown"]);
const ClientRoleSchema = z.enum(["tab", "background"]);

export const HelloMessageSchema = z.object({
  type: z.literal("hello"),
  protocolVersion: z.literal(BRIDGE_PROTOCOL_VERSION),
  token: z.string().min(1),
  payload: z.object({
    tabUrl: z.string().url(),
    pageType: PageTypeSchema,
    clientRole: ClientRoleSchema.optional(),
    pageTitle: z.string().optional(),
    gptName: z.string().optional(),
    authenticated: z.boolean().optional(),
    details: z.string().optional(),
    extensionVersion: z.string().optional(),
  }),
});

export const ContextUpdateMessageSchema = z.object({
  type: z.literal("context_update"),
  payload: z.object({
    tabUrl: z.string().url(),
    pageType: PageTypeSchema,
    clientRole: ClientRoleSchema.optional(),
    pageTitle: z.string().optional(),
    gptName: z.string().optional(),
    authenticated: z.boolean().optional(),
    details: z.string().optional(),
  }),
});

export const ResultMessageSchema = z.object({
  type: z.literal("result"),
  commandId: z.string().min(1),
  success: z.boolean(),
  payload: z.unknown().optional(),
  error: z.object({
    code: z.string().optional(),
    message: z.string().min(1),
    details: z.unknown().optional(),
  }).optional(),
});

export const ExtensionToServerMessageSchema = z.union([
  HelloMessageSchema,
  ContextUpdateMessageSchema,
  ResultMessageSchema,
]);

export type HelloMessage = z.infer<typeof HelloMessageSchema>;
export type ContextUpdateMessage = z.infer<typeof ContextUpdateMessageSchema>;
export type ResultMessage = z.infer<typeof ResultMessageSchema>;
export type ExtensionToServerMessage = z.infer<typeof ExtensionToServerMessageSchema>;

export interface CommandMessage<TPayload = Record<string, unknown>> {
  type: "command";
  commandId: string;
  action: string;
  payload: TPayload;
}

export interface GenerateImageCommandPayload {
  prompt: string;
  timeoutMs: number;
  startNewChat?: boolean;
}

export interface GenerateImageCommandResult {
  images: BridgeGeneratedImage[];
}

export interface OpenChatGptTabCommandPayload {
  url: string;
  active?: boolean;
}

export interface HelloAckMessage {
  type: "hello_ack";
  sessionId: string;
  tabKey: string;
  serverVersion: string;
  expectedExtensionVersion: string;
}

export interface HandshakePayload {
  protocolVersion: number;
  wsUrl: string;
  token: string;
  serverVersion: string;
  expectedExtensionVersion: string;
}

export function buildValidateSessionCommand(commandId: string): CommandMessage<Record<string, never>> {
  return {
    type: "command",
    commandId,
    action: "validate_session",
    payload: {},
  };
}

export function buildGenerateImageCommand(
  commandId: string,
  payload: GenerateImageCommandPayload,
): CommandMessage<GenerateImageCommandPayload> {
  return {
    type: "command",
    commandId,
    action: "generate_image",
    payload,
  };
}

export function buildOpenChatGptTabCommand(
  commandId: string,
  payload: OpenChatGptTabCommandPayload,
): CommandMessage<OpenChatGptTabCommandPayload> {
  return {
    type: "command",
    commandId,
    action: "open_chatgpt_tab",
    payload,
  };
}

export function mapPayloadToContext(payload: {
  tabUrl: string;
  pageType: ChatGptTabContext["pageType"];
  pageTitle?: string;
  gptName?: string;
  authenticated?: boolean;
  details?: string;
}): ChatGptTabContext {
  return {
    authenticated: payload.authenticated ?? false,
    currentUrl: payload.tabUrl,
    details: payload.details,
    pageType: payload.pageType,
    pageTitle: payload.pageTitle,
    gpt: payload.gptName ? { name: payload.gptName } : undefined,
  };
}
