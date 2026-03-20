import { AppError } from "../errors.js";
import type { BridgeGeneratedImage, ChatGptTabContext, ExtensionTabSession } from "../types.js";
import { ExtensionBridgeServer } from "./server.js";

export class ExtensionCommandRouter {
  public constructor(private readonly bridge: ExtensionBridgeServer) {}

  public listTabs(): ExtensionTabSession[] {
    return this.bridge.listSessions();
  }

  public selectTab(tabKey: string): ExtensionTabSession {
    return this.bridge.selectTab(tabKey);
  }

  public getSelectedTab(): ExtensionTabSession {
    const selected = this.bridge.getSelectedSession();
    if (!selected) {
      throw new AppError("EXTENSION_NOT_CONNECTED", "No ChatGPT extension session is currently connected.");
    }

    return selected;
  }

  public async validateSelectedSession(timeoutMs = 15000): Promise<ChatGptTabContext> {
    const result = await this.bridge.validateSelectedSession(timeoutMs);
    if (!result.currentUrl) {
      throw new AppError("PAGE_CONTEXT_INVALID", "The connected ChatGPT tab did not return a valid URL.", {
        details: result,
      });
    }

    return result;
  }

  public async generateImage(
    prompt: string,
    timeoutMs: number,
    options?: { startNewChat?: boolean },
  ): Promise<BridgeGeneratedImage[]> {
    const result = await this.bridge.generateImages(prompt, timeoutMs, options);
    if (!Array.isArray(result.images) || result.images.length === 0) {
      throw new AppError("IMAGE_NOT_FOUND", "The connected ChatGPT tab did not return any generated images.");
    }

    return result.images;
  }
}
