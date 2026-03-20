import { writeBridgeSettings } from "./shared/settings.js";

async function main(): Promise<void> {
  const enabledToggle = document.querySelector<HTMLInputElement>("#bridge-enabled");
  const refreshButton = document.querySelector<HTMLButtonElement>("#refresh-connection");
  const openChatGptButton = document.querySelector<HTMLButtonElement>("#open-chatgpt");
  const openOptionsButton = document.querySelector<HTMLButtonElement>("#open-options");

  if (!enabledToggle || !refreshButton || !openChatGptButton || !openOptionsButton) {
    return;
  }

  const render = async () => {
    const response = await chrome.runtime.sendMessage({ type: "get_bridge_diagnostics" }) as {
      ok?: boolean;
      diagnostics?: {
        bridgeEnabled: boolean;
        bridgeHost: string;
        bridgePort: number;
        connectionState: string;
        handshakeUrl: string;
        extensionVersion: string;
        serverVersion?: string;
        expectedExtensionVersion?: string;
        lastConnectedAt?: string;
        lastError?: string;
        openChatGptTabCount: number;
      };
      error?: string;
    };

    if (!response?.ok || !response.diagnostics) {
      setText("#status", "Unavailable");
      setText("#last-error", response?.error ?? "Unable to read bridge diagnostics.");
      return;
    }

    const { diagnostics } = response;
    enabledToggle.checked = diagnostics.bridgeEnabled;
    setText("#status", diagnostics.connectionState);
    setText("#handshake-url", diagnostics.handshakeUrl);
    setText("#extension-version", diagnostics.extensionVersion);
    setText("#server-version", diagnostics.serverVersion ?? "Unknown");
    setText("#expected-extension-version", diagnostics.expectedExtensionVersion ?? "Unknown");
    setText("#open-tab-count", String(diagnostics.openChatGptTabCount));
    setText("#last-connected-at", diagnostics.lastConnectedAt ?? "Never");
    setText("#last-error", diagnostics.lastError ?? "None");
  };

  enabledToggle.addEventListener("change", async () => {
    await writeBridgeSettings({ bridgeEnabled: enabledToggle.checked });
    await chrome.runtime.sendMessage({ type: "refresh_bridge_connection" });
    await render();
  });

  refreshButton.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "refresh_bridge_connection" });
    await render();
  });

  openChatGptButton.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "open_chatgpt_tab_ui" });
  });

  openOptionsButton.addEventListener("click", () => {
    void chrome.runtime.openOptionsPage();
  });

  await render();
}

function setText(selector: string, value: string): void {
  const element = document.querySelector<HTMLElement>(selector);
  if (element) {
    element.textContent = value;
  }
}

void main();
