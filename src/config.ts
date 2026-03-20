import path from "node:path";
import { AppError } from "./errors.js";
import type { AppConfig, ReturnMode } from "./types.js";

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

  throw new AppError("INVALID_CONFIG", "CHATGPT_RETURN_MODE must be either 'paths' or 'base64'.", {
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
  if (!env.CHATGPT_AUTOMATION_PROFILE_PATH && env.CHATGPT_CHROME_PROFILE_DIRECTORY) {
    throw new AppError(
      "INVALID_CONFIG",
      "CHATGPT_CHROME_PROFILE_DIRECTORY requires CHATGPT_AUTOMATION_PROFILE_PATH to also be set.",
      {
        details: {
          profileDirectory: env.CHATGPT_CHROME_PROFILE_DIRECTORY,
        },
      },
    );
  }

  const artifactRoot = resolvePath(cwd, env.CHATGPT_ARTIFACT_ROOT) ??
    path.resolve(cwd, "artifacts/generated-images/chatgpt");

  return {
    chatGptBaseUrl: env.CHATGPT_BASE_URL?.trim() || "https://chatgpt.com",
    returnMode: parseReturnMode(env.CHATGPT_RETURN_MODE),
    paths: {
      cwd,
      artifactRoot,
    },
    retry: {
      attempts: parseInteger(env.CHATGPT_RETRY_ATTEMPTS, 3, "CHATGPT_RETRY_ATTEMPTS"),
      baseDelayMs: parseInteger(env.CHATGPT_RETRY_BASE_DELAY_MS, 1000, "CHATGPT_RETRY_BASE_DELAY_MS"),
    },
    timeouts: {
      defaultTimeoutMs: parseInteger(env.CHATGPT_DEFAULT_TIMEOUT_MS, 240000, "CHATGPT_DEFAULT_TIMEOUT_MS"),
      maxTimeoutMs: parseInteger(env.CHATGPT_MAX_TIMEOUT_MS, 600000, "CHATGPT_MAX_TIMEOUT_MS"),
    },
    browser: {
      headless: env.CHATGPT_BROWSER_HEADLESS === "true",
    },
    browserLaunch: {
      automationProfilePath: resolvePath(cwd, env.CHATGPT_AUTOMATION_PROFILE_PATH?.trim()),
      cloneAutomationProfile: env.CHATGPT_CLONE_PROFILE !== "false",
      chromeProfileDirectory: env.CHATGPT_CHROME_PROFILE_DIRECTORY?.trim() || undefined,
      chromeExecutablePath: resolvePath(cwd, env.CHATGPT_CHROME_EXECUTABLE_PATH?.trim()),
    },
    extensionBridge: {
      host: env.CHATGPT_EXTENSION_BRIDGE_HOST?.trim() || "127.0.0.1",
      port: parseInteger(env.CHATGPT_EXTENSION_BRIDGE_PORT, 47821, "CHATGPT_EXTENSION_BRIDGE_PORT"),
    },
  };
}
