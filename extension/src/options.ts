import {
  DEFAULT_BRIDGE_HOST,
  DEFAULT_BRIDGE_PORT,
  readBridgeDiagnostics,
  readBridgeSettings,
  writeBridgeSettings,
} from "./shared/settings.js";

async function main(): Promise<void> {
  const hostInput = document.querySelector<HTMLInputElement>("#bridge-host");
  const portInput = document.querySelector<HTMLInputElement>("#bridge-port");
  const saveButton = document.querySelector<HTMLButtonElement>("#save-settings");
  const resetButton = document.querySelector<HTMLButtonElement>("#reset-defaults");
  const statusText = document.querySelector<HTMLElement>("#save-status");

  if (!hostInput || !portInput || !saveButton || !resetButton || !statusText) {
    return;
  }

  const settings = await readBridgeSettings();
  const diagnostics = await readBridgeDiagnostics();
  hostInput.value = settings.bridgeHost;
  portInput.value = String(settings.bridgePort);
  setText("#extension-version", diagnostics.extensionVersion);
  setText("#server-version", diagnostics.serverVersion ?? "Unknown");
  setText("#last-error", diagnostics.lastError ?? "None");

  saveButton.addEventListener("click", async () => {
    const bridgeHost = hostInput.value.trim() || DEFAULT_BRIDGE_HOST;
    const parsedPort = Number.parseInt(portInput.value.trim(), 10);
    const bridgePort = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_BRIDGE_PORT;

    await writeBridgeSettings({
      bridgeHost,
      bridgePort,
    });
    await chrome.runtime.sendMessage({ type: "refresh_bridge_connection" });
    statusText.textContent = "Saved.";
  });

  resetButton.addEventListener("click", async () => {
    hostInput.value = DEFAULT_BRIDGE_HOST;
    portInput.value = String(DEFAULT_BRIDGE_PORT);
    await writeBridgeSettings({
      bridgeHost: DEFAULT_BRIDGE_HOST,
      bridgePort: DEFAULT_BRIDGE_PORT,
    });
    await chrome.runtime.sendMessage({ type: "refresh_bridge_connection" });
    statusText.textContent = "Defaults restored.";
  });
}

function setText(selector: string, value: string): void {
  const element = document.querySelector<HTMLElement>(selector);
  if (element) {
    element.textContent = value;
  }
}

void main();
