import { randomUUID } from "node:crypto";
import type { ExtensionTabSession } from "../types.js";
import { toIsoTimestamp } from "../utils/time.js";
import type { HelloPayload, RegisteredExtensionSession } from "./types.js";

export class ExtensionSessionRegistry {
  private readonly sessions = new Map<string, RegisteredExtensionSession>();
  private selectedSessionId?: string;

  public register(socket: RegisteredExtensionSession["socket"], payload: HelloPayload): RegisteredExtensionSession {
    const timestamp = toIsoTimestamp();
    const session: RegisteredExtensionSession = {
      sessionId: randomUUID(),
      tabKey: randomUUID(),
      currentUrl: payload.tabUrl,
      pageType: payload.pageType,
      pageTitle: payload.pageTitle,
      gptName: payload.gptName,
      authenticated: payload.authenticated,
      details: payload.details,
      connectedAt: timestamp,
      lastSeenAt: timestamp,
      selected: this.sessions.size === 0,
      socket,
    };

    this.sessions.set(session.sessionId, session);
    if (session.selected) {
      this.selectedSessionId = session.sessionId;
    }

    return session;
  }

  public updateContext(sessionId: string, payload: HelloPayload): RegisteredExtensionSession | undefined {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      return undefined;
    }

    existing.currentUrl = payload.tabUrl;
    existing.pageType = payload.pageType;
    existing.pageTitle = payload.pageTitle;
    existing.gptName = payload.gptName;
    existing.authenticated = payload.authenticated;
    existing.details = payload.details;
    existing.lastSeenAt = toIsoTimestamp();
    return existing;
  }

  public touch(sessionId: string): void {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      existing.lastSeenAt = toIsoTimestamp();
    }
  }

  public remove(sessionId: string): void {
    const removed = this.sessions.get(sessionId);
    if (!removed) {
      return;
    }

    this.sessions.delete(sessionId);
    if (this.selectedSessionId === sessionId) {
      const next = this.sessions.values().next().value as RegisteredExtensionSession | undefined;
      this.selectedSessionId = next?.sessionId;
      if (next) {
        next.selected = true;
      }
    }
  }

  public list(): ExtensionTabSession[] {
    return Array.from(this.sessions.values()).map(({ socket: _socket, ...rest }) => ({ ...rest }));
  }

  public getSelected(): RegisteredExtensionSession | undefined {
    if (!this.selectedSessionId) {
      return undefined;
    }

    return this.sessions.get(this.selectedSessionId);
  }

  public getByTabKey(tabKey: string): RegisteredExtensionSession | undefined {
    return Array.from(this.sessions.values()).find((session) => session.tabKey === tabKey);
  }

  public selectByTabKey(tabKey: string): RegisteredExtensionSession | undefined {
    const target = this.getByTabKey(tabKey);
    if (!target) {
      return undefined;
    }

    for (const session of this.sessions.values()) {
      session.selected = session.sessionId === target.sessionId;
    }
    this.selectedSessionId = target.sessionId;
    return target;
  }
}
