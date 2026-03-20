import { createServer, type Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import WebSocket, { WebSocketServer } from "ws";
import { AppError } from "../errors.js";
import type { AppConfig, ChatGptTabContext, ExtensionTabSession } from "../types.js";
import {
  BRIDGE_PROTOCOL_VERSION,
  buildGenerateImageCommand,
  buildOpenChatGptTabCommand,
  ExtensionToServerMessageSchema,
  buildValidateSessionCommand,
  mapPayloadToContext,
  type ContextUpdateMessage,
  type GenerateImageCommandResult,
  type HandshakePayload,
  type HelloAckMessage,
  type ResultMessage,
} from "./protocol.js";
import { ExtensionSessionRegistry } from "./sessionRegistry.js";
import type { PendingCommand, RegisteredExtensionSession } from "./types.js";
import { areVersionsCompatible, getPackageVersion } from "../utils/version.js";

export class ExtensionBridgeServer {
  private httpServer?: HttpServer;
  private wsServer?: WebSocketServer;
  private readonly registry = new ExtensionSessionRegistry();
  private readonly pendingCommands = new Map<string, PendingCommand>();
  private backgroundSocket?: WebSocket;
  private backgroundSessionId?: string;
  private readonly serverVersion = getPackageVersion();

  public constructor(
    private readonly config: AppConfig,
    private readonly token: string,
  ) {}

  public async start(): Promise<void> {
    if (this.httpServer) {
      return;
    }

    const httpServer = createServer((request, response) => {
      if (request.method === "GET" && request.url === "/handshake") {
        const payload: HandshakePayload = {
          protocolVersion: BRIDGE_PROTOCOL_VERSION,
          wsUrl: `ws://${this.config.extensionBridge.host}:${this.config.extensionBridge.port}/ws`,
          token: this.token,
          serverVersion: this.serverVersion,
          expectedExtensionVersion: this.serverVersion,
        };
        response.writeHead(200, {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
        });
        response.end(`${JSON.stringify(payload)}\n`);
        return;
      }

      response.writeHead(404);
      response.end();
    });

    const wsServer = new WebSocketServer({ noServer: true });
    httpServer.on("upgrade", (request, socket, head) => {
      if (request.url !== "/ws") {
        socket.destroy();
        return;
      }

      wsServer.handleUpgrade(request, socket, head, (websocket) => {
        wsServer.emit("connection", websocket, request);
      });
    });

    wsServer.on("connection", (socket) => {
      let sessionId: string | undefined;
      let isBackground = false;

      socket.on("message", (data) => {
        try {
          const parsed = ExtensionToServerMessageSchema.parse(JSON.parse(data.toString("utf8")));
          if (parsed.type === "hello") {
            if (parsed.token !== this.token) {
              socket.close(4001, "Invalid token");
              return;
            }

            if (!areVersionsCompatible(this.serverVersion, parsed.payload.extensionVersion)) {
              socket.close(4003, "Extension version mismatch");
              return;
            }

            let tabKey = "background-control";
            if (parsed.payload.clientRole === "background") {
              this.backgroundSocket = socket;
              sessionId = randomUUID();
              this.backgroundSessionId = sessionId;
              isBackground = true;
            } else {
              const registered = this.registry.register(socket, parsed.payload);
              sessionId = registered.sessionId;
              tabKey = registered.tabKey;
            }

            const ack: HelloAckMessage = {
              type: "hello_ack",
              sessionId,
              tabKey,
              serverVersion: this.serverVersion,
              expectedExtensionVersion: this.serverVersion,
            };
            socket.send(JSON.stringify(ack));
            return;
          }

          if (!sessionId) {
            socket.close(4002, "Session not initialized");
            return;
          }

          if (parsed.type === "context_update") {
            if (!isBackground) {
              this.registry.updateContext(sessionId, parsed.payload);
            }
            return;
          }

          if (parsed.type === "result") {
            this.resolvePendingResult(parsed);
            if (!isBackground) {
              this.registry.touch(sessionId);
            }
          }
        } catch {
          socket.close(4000, "Invalid message");
        }
      });

      socket.on("close", () => {
        if (isBackground && this.backgroundSessionId === sessionId) {
          this.backgroundSocket = undefined;
          this.backgroundSessionId = undefined;
          return;
        }

        if (sessionId) {
          this.registry.remove(sessionId);
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(
        this.config.extensionBridge.port,
        this.config.extensionBridge.host,
        () => resolve(),
      );
    });

    this.httpServer = httpServer;
    this.wsServer = wsServer;
  }

  public async close(): Promise<void> {
    for (const [commandId, pending] of this.pendingCommands) {
      clearTimeout(pending.timeout);
      pending.reject(new AppError("BRIDGE_TIMEOUT", `Bridge command '${commandId}' was interrupted by shutdown.`));
      this.pendingCommands.delete(commandId);
    }

    this.backgroundSocket = undefined;
    this.backgroundSessionId = undefined;

    const wsServer = this.wsServer;
    this.wsServer = undefined;
    if (wsServer) {
      for (const client of wsServer.clients) {
        client.terminate();
      }

      await new Promise<void>((resolve) => {
        wsServer.close(() => resolve());
      });
    }

    const httpServer = this.httpServer;
    this.httpServer = undefined;
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => error ? reject(error) : resolve());
      });
    }
  }

  public listSessions(): ExtensionTabSession[] {
    return this.registry.list();
  }

  public selectTab(tabKey: string): ExtensionTabSession {
    const selected = this.registry.selectByTabKey(tabKey);
    if (!selected) {
      throw new AppError("NO_ACTIVE_CHATGPT_TAB", `No connected ChatGPT tab matches '${tabKey}'.`);
    }

    return this.toPublicSession(selected);
  }

  public getSelectedSession(): ExtensionTabSession | undefined {
    const selected = this.registry.getSelected();
    return selected ? this.toPublicSession(selected) : undefined;
  }

  public async generateImages(
    prompt: string,
    timeoutMs: number,
    options?: { startNewChat?: boolean },
  ): Promise<GenerateImageCommandResult> {
    const selected = this.registry.getSelected();
    if (!selected) {
      throw new AppError("EXTENSION_NOT_CONNECTED", "No ChatGPT extension session is currently connected.", {
        details: {
          bridgeUrl: `ws://${this.config.extensionBridge.host}:${this.config.extensionBridge.port}/ws`,
        },
      });
    }

    return this.sendCommand<GenerateImageCommandResult>(
      selected,
      buildGenerateImageCommand(randomUUID(), {
        prompt,
        timeoutMs,
        startNewChat: options?.startNewChat ?? false,
      }),
      timeoutMs + 15000,
    );
  }

  public async validateSelectedSession(timeoutMs = 15000): Promise<ChatGptTabContext> {
    const selected = this.registry.getSelected();
    if (!selected) {
      throw new AppError("EXTENSION_NOT_CONNECTED", "No ChatGPT extension session is currently connected.", {
        details: {
          bridgeUrl: `ws://${this.config.extensionBridge.host}:${this.config.extensionBridge.port}/ws`,
        },
      });
    }

    const result = await this.sendCommand<ChatGptTabContext>(
      selected,
      buildValidateSessionCommand(randomUUID()),
      timeoutMs,
    );

    return {
      ...result,
      currentUrl: result.currentUrl ?? selected.currentUrl,
      details: result.details ?? selected.details,
    };
  }

  public async openChatGptTab(
    url: string,
    options?: { active?: boolean; timeoutMs?: number },
  ): Promise<void> {
    const socket = this.backgroundSocket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new AppError("EXTENSION_NOT_CONNECTED", "No extension background control connection is currently available.", {
        retryable: true,
        details: {
          bridgeUrl: `ws://${this.config.extensionBridge.host}:${this.config.extensionBridge.port}/ws`,
        },
      });
    }

    await this.sendSocketCommand(
      socket,
      buildOpenChatGptTabCommand(randomUUID(), {
        url,
        active: options?.active ?? false,
      }),
      options?.timeoutMs ?? 15000,
      {
        sessionId: this.backgroundSessionId ?? "background",
      },
    );
  }

  private async sendCommand<TResult>(
    session: RegisteredExtensionSession,
    message: { commandId: string; type: "command"; action: string; payload: object },
    timeoutMs: number,
  ): Promise<TResult> {
    return this.sendSocketCommand(session.socket, message, timeoutMs, {
      sessionId: session.sessionId,
      disconnectedMessage: "The selected ChatGPT tab connection is no longer open.",
    });
  }

  private async sendSocketCommand<TResult>(
    socket: WebSocket,
    message: { commandId: string; type: "command"; action: string; payload: object },
    timeoutMs: number,
    options?: { sessionId?: string; disconnectedMessage?: string },
  ): Promise<TResult> {
    if (socket.readyState !== WebSocket.OPEN) {
      throw new AppError(
        "EXTENSION_NOT_CONNECTED",
        options?.disconnectedMessage ?? "The extension connection is no longer open.",
      );
    }

    return new Promise<TResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(message.commandId);
        reject(new AppError("BRIDGE_TIMEOUT", `Timed out waiting for bridge action '${message.action}'.`, {
          details: {
            timeoutMs,
            action: message.action,
            sessionId: options?.sessionId,
          },
        }));
      }, timeoutMs);

      this.pendingCommands.set(message.commandId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      socket.send(JSON.stringify(message));
    });
  }

  private resolvePendingResult(message: ResultMessage): void {
    const pending = this.pendingCommands.get(message.commandId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingCommands.delete(message.commandId);

    if (!message.success) {
      pending.reject(
        new AppError(
          message.error?.code === "PAGE_CONTEXT_INVALID" ? "PAGE_CONTEXT_INVALID" : "AUTOMATION_FAILURE",
          message.error?.message ?? "Extension command failed.",
          {
            details: message.error?.details,
          },
        ),
      );
      return;
    }

    const payload = message.payload;
    const contextLike = payload && typeof payload === "object" && "tabUrl" in (payload as Record<string, unknown>);
    pending.resolve(contextLike ? mapPayloadToContext(payload as ContextUpdateMessage["payload"]) : payload);
  }

  private toPublicSession(session: RegisteredExtensionSession): ExtensionTabSession {
    return {
      sessionId: session.sessionId,
      tabKey: session.tabKey,
      currentUrl: session.currentUrl,
      pageType: session.pageType,
      pageTitle: session.pageTitle,
      gptName: session.gptName,
      authenticated: session.authenticated,
      details: session.details,
      connectedAt: session.connectedAt,
      lastSeenAt: session.lastSeenAt,
      selected: session.selected,
    };
  }
}
