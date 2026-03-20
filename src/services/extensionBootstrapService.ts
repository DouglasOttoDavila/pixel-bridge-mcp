import { spawn } from "node:child_process";
import { AppError } from "../errors.js";
import { ExtensionBridgeServer } from "../extensionBridge/server.js";
import type { AppConfig, ExtensionTabSession, SessionBootstrapDiagnostic } from "../types.js";

export class ExtensionBootstrapService {
  public inspect(config: AppConfig): SessionBootstrapDiagnostic {
    return {
      status: "ready",
      messages: [
        "Extension bridge is ready for ChatGPT tab connections.",
        `Bridge handshake URL: http://${config.extensionBridge.host}:${config.extensionBridge.port}/handshake`,
      ],
      checklist: [
        "Build or load the unpacked Chrome extension from the local 'extension/' folder.",
        "Open https://chatgpt.com/ in Chrome with the extension enabled.",
        "Let the extension content script connect to the local bridge.",
        "Use list_connected_chatgpt_tabs() if multiple ChatGPT tabs are open.",
      ],
    };
  }

  public async ensureConnectedTab(
    config: AppConfig,
    bridge: ExtensionBridgeServer,
    options?: {
      timeoutMs?: number;
      url?: string;
    },
  ): Promise<ExtensionTabSession> {
    const selected = bridge.getSelectedSession();
    if (selected) {
      return selected;
    }

    const url = options?.url ?? config.chatGptBaseUrl;
    try {
      await bridge.openChatGptTab(url, {
        active: false,
        timeoutMs: 5000,
      });
    } catch {
      this.openChatGptUrl(url, config.browserLaunch.chromeExecutablePath);
    }

    const timeoutMs = options?.timeoutMs ?? 30000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const sessions = bridge.listSessions();
      if (sessions.length > 0) {
        const latest = [...sessions].sort((left, right) =>
          Date.parse(right.connectedAt) - Date.parse(left.connectedAt)
        )[0];

        if (!latest) {
          break;
        }

        return bridge.selectTab(latest.tabKey);
      }

      await sleep(1000);
    }

    throw new AppError("EXTENSION_NOT_CONNECTED", "No ChatGPT extension session is currently connected.", {
      retryable: true,
      details: {
        attemptedUrl: url,
        timeoutMs,
      },
    });
  }

  private openChatGptUrl(url: string, chromeExecutablePath?: string): void {
    if (chromeExecutablePath) {
      const child = spawn(chromeExecutablePath, [url], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      return;
    }

    const child = process.platform === "win32"
      ? spawn("cmd", ["/c", "start", "", url], {
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        })
      : process.platform === "darwin"
        ? spawn("open", [url], {
            detached: true,
            stdio: "ignore",
          })
        : spawn("xdg-open", [url], {
            detached: true,
            stdio: "ignore",
          });

    child.unref();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
