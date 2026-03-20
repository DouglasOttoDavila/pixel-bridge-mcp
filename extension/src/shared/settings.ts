export interface BridgeSettings {
  bridgeEnabled: boolean;
  bridgeHost: string;
  bridgePort: number;
}

export interface BridgeDiagnostics {
  connectionState: "disabled" | "connecting" | "connected" | "error" | "version_mismatch";
  handshakeUrl: string;
  extensionVersion: string;
  serverVersion?: string;
  expectedExtensionVersion?: string;
  lastConnectedAt?: string;
  lastError?: string;
}

export const DEFAULT_BRIDGE_HOST = "127.0.0.1";
export const DEFAULT_BRIDGE_PORT = 47821;

export async function readBridgeSettings(): Promise<BridgeSettings> {
  return new Promise<BridgeSettings>((resolve) => {
    chrome.storage.local.get(["bridgeEnabled", "bridgeHost", "bridgePort"], (values) => {
      resolve({
        bridgeEnabled: values.bridgeEnabled !== false,
        bridgeHost: typeof values.bridgeHost === "string" && values.bridgeHost.trim()
          ? values.bridgeHost.trim()
          : DEFAULT_BRIDGE_HOST,
        bridgePort: typeof values.bridgePort === "number" && Number.isFinite(values.bridgePort)
          ? values.bridgePort
          : DEFAULT_BRIDGE_PORT,
      });
    });
  });
}

export async function writeBridgeSettings(update: Partial<BridgeSettings>): Promise<void> {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set(update, () => resolve());
  });
}

export async function readBridgeDiagnostics(): Promise<BridgeDiagnostics> {
  return new Promise<BridgeDiagnostics>((resolve) => {
    chrome.storage.local.get(["bridgeDiagnostics"], (values) => {
      const diagnostics = values.bridgeDiagnostics as Partial<BridgeDiagnostics> | undefined;
      resolve({
        connectionState: diagnostics?.connectionState ?? "connecting",
        handshakeUrl: diagnostics?.handshakeUrl ?? buildHandshakeUrl({
          bridgeHost: DEFAULT_BRIDGE_HOST,
          bridgePort: DEFAULT_BRIDGE_PORT,
        }),
        extensionVersion: diagnostics?.extensionVersion ?? chrome.runtime.getManifest().version,
        serverVersion: diagnostics?.serverVersion,
        expectedExtensionVersion: diagnostics?.expectedExtensionVersion,
        lastConnectedAt: diagnostics?.lastConnectedAt,
        lastError: diagnostics?.lastError,
      });
    });
  });
}

export async function writeBridgeDiagnostics(update: Partial<BridgeDiagnostics>): Promise<void> {
  const current = await readBridgeDiagnostics();
  return new Promise<void>((resolve) => {
    chrome.storage.local.set({
      bridgeDiagnostics: {
        ...current,
        ...update,
      },
    }, () => resolve());
  });
}

export function buildHandshakeUrl(settings: Pick<BridgeSettings, "bridgeHost" | "bridgePort">): string {
  return `http://${settings.bridgeHost}:${settings.bridgePort}/handshake`;
}
