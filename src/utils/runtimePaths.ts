import os from "node:os";
import path from "node:path";

const APP_DIRECTORY_NAME = "chatgpt-browser-image-generation-mcp-server";

export function resolveRuntimeHome(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): string {
  const explicitRuntimeHome = env.CHATGPT_RUNTIME_HOME?.trim();
  if (explicitRuntimeHome) {
    return path.isAbsolute(explicitRuntimeHome)
      ? explicitRuntimeHome
      : path.resolve(cwd, explicitRuntimeHome);
  }

  if (process.platform === "win32") {
    const baseDirectory = env.LOCALAPPDATA?.trim() || env.APPDATA?.trim();
    if (baseDirectory) {
      return path.join(baseDirectory, APP_DIRECTORY_NAME);
    }

    return path.join(os.homedir(), "AppData", "Local", APP_DIRECTORY_NAME);
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", APP_DIRECTORY_NAME);
  }

  const xdgDataHome = env.XDG_DATA_HOME?.trim();
  if (xdgDataHome) {
    return path.join(xdgDataHome, APP_DIRECTORY_NAME);
  }

  return path.join(os.homedir(), ".local", "share", APP_DIRECTORY_NAME);
}

export function resolveDefaultArtifactRoot(runtimeHome: string): string {
  return path.join(runtimeHome, "artifacts", "generated-images", "chatgpt");
}
