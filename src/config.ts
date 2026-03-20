import path from "node:path";
import { AppError } from "./errors.js";
import type { AppConfig, ReturnMode } from "./types.js";
import { resolveDefaultArtifactRoot, resolveRuntimeHome } from "./utils/runtimePaths.js";

function getEnvValue(env: NodeJS.ProcessEnv, preferredKey: string, legacyKey?: string): string | undefined {
  return env[preferredKey] ?? (legacyKey ? env[legacyKey] : undefined);
}

function parseInteger(value: string | undefined, fallback: number, label: string): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError("INVALID_CONFIG", `${label} must be a positive integer.`, {
      details: { value },
    });
  }

  return parsed;
}

function parseReturnMode(value: string | undefined): ReturnMode {
  if (!value) {
    return "paths";
  }

  if (value === "paths" || value === "base64") {
    return value;
  }

  throw new AppError("INVALID_CONFIG", "PIXELBRIDGE_RETURN_MODE must be either 'paths' or 'base64'.", {
    details: { value },
  });
}

function resolvePath(cwd: string, input: string | undefined): string | undefined {
  if (!input) {
    return undefined;
  }

  return path.isAbsolute(input) ? input : path.resolve(cwd, input);
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): AppConfig {
  const automationProfilePath = getEnvValue(
    env,
    "PIXELBRIDGE_AUTOMATION_PROFILE_PATH",
    "CHATGPT_AUTOMATION_PROFILE_PATH",
  );
  const chromeProfileDirectory = getEnvValue(
    env,
    "PIXELBRIDGE_CHROME_PROFILE_DIRECTORY",
    "CHATGPT_CHROME_PROFILE_DIRECTORY",
  );
  const artifactRootInput = getEnvValue(env, "PIXELBRIDGE_ARTIFACT_ROOT", "CHATGPT_ARTIFACT_ROOT");
  const baseUrl = getEnvValue(env, "PIXELBRIDGE_BASE_URL", "CHATGPT_BASE_URL");
  const returnMode = getEnvValue(env, "PIXELBRIDGE_RETURN_MODE", "CHATGPT_RETURN_MODE");
  const retryAttempts = getEnvValue(env, "PIXELBRIDGE_RETRY_ATTEMPTS", "CHATGPT_RETRY_ATTEMPTS");
  const retryBaseDelayMs = getEnvValue(
    env,
    "PIXELBRIDGE_RETRY_BASE_DELAY_MS",
    "CHATGPT_RETRY_BASE_DELAY_MS",
  );
  const defaultTimeoutMs = getEnvValue(
    env,
    "PIXELBRIDGE_DEFAULT_TIMEOUT_MS",
    "CHATGPT_DEFAULT_TIMEOUT_MS",
  );
  const maxTimeoutMs = getEnvValue(env, "PIXELBRIDGE_MAX_TIMEOUT_MS", "CHATGPT_MAX_TIMEOUT_MS");
  const browserHeadless = getEnvValue(env, "PIXELBRIDGE_BROWSER_HEADLESS", "CHATGPT_BROWSER_HEADLESS");
  const cloneProfile = getEnvValue(env, "PIXELBRIDGE_CLONE_PROFILE", "CHATGPT_CLONE_PROFILE");
  const chromeExecutablePath = getEnvValue(
    env,
    "PIXELBRIDGE_CHROME_EXECUTABLE_PATH",
    "CHATGPT_CHROME_EXECUTABLE_PATH",
  );
  const extensionBridgeHost = getEnvValue(
    env,
    "PIXELBRIDGE_EXTENSION_BRIDGE_HOST",
    "CHATGPT_EXTENSION_BRIDGE_HOST",
  );
  const extensionBridgePort = getEnvValue(
    env,
    "PIXELBRIDGE_EXTENSION_BRIDGE_PORT",
    "CHATGPT_EXTENSION_BRIDGE_PORT",
  );

  if (!automationProfilePath && chromeProfileDirectory) {
    throw new AppError(
      "INVALID_CONFIG",
      "PIXELBRIDGE_CHROME_PROFILE_DIRECTORY requires PIXELBRIDGE_AUTOMATION_PROFILE_PATH to also be set.",
      {
        details: {
          profileDirectory: chromeProfileDirectory,
        },
      },
    );
  }

  const runtimeHome = resolveRuntimeHome(env, cwd);
  const artifactRoot = resolvePath(cwd, artifactRootInput) ??
    resolveDefaultArtifactRoot(runtimeHome);

  return {
    chatGptBaseUrl: baseUrl?.trim() || "https://chatgpt.com",
    returnMode: parseReturnMode(returnMode),
    paths: {
      cwd,
      runtimeHome,
      artifactRoot,
    },
    retry: {
      attempts: parseInteger(retryAttempts, 3, "PIXELBRIDGE_RETRY_ATTEMPTS"),
      baseDelayMs: parseInteger(retryBaseDelayMs, 1000, "PIXELBRIDGE_RETRY_BASE_DELAY_MS"),
    },
    timeouts: {
      defaultTimeoutMs: parseInteger(defaultTimeoutMs, 240000, "PIXELBRIDGE_DEFAULT_TIMEOUT_MS"),
      maxTimeoutMs: parseInteger(maxTimeoutMs, 600000, "PIXELBRIDGE_MAX_TIMEOUT_MS"),
    },
    browser: {
      headless: browserHeadless === "true",
    },
    browserLaunch: {
      automationProfilePath: resolvePath(cwd, automationProfilePath?.trim()),
      cloneAutomationProfile: cloneProfile !== "false",
      chromeProfileDirectory: chromeProfileDirectory?.trim() || undefined,
      chromeExecutablePath: resolvePath(cwd, chromeExecutablePath?.trim()),
    },
    extensionBridge: {
      host: extensionBridgeHost?.trim() || "127.0.0.1",
      port: parseInteger(extensionBridgePort, 47821, "PIXELBRIDGE_EXTENSION_BRIDGE_PORT"),
    },
  };
}
