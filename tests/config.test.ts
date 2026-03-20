import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";
import { AppError } from "../src/errors.js";

export async function runConfigTests(): Promise<void> {
  const tempDirs: string[] = [];
  const createTempDir = async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "chatgpt-browser-mcp-config-"));
    tempDirs.push(dir);
    return dir;
  };

  try {
    {
      const cwd = await createTempDir();
      const config = loadConfig(
        {
          CHATGPT_BROWSER_HEADLESS: "true",
          CHATGPT_AUTOMATION_PROFILE_PATH: "Profile 16",
          CHATGPT_CHROME_EXECUTABLE_PATH: "C:/Program Files/Google/Chrome/Application/chrome.exe",
        },
        cwd,
      );

      assert.equal(config.paths.artifactRoot, path.join(cwd, "artifacts/generated-images/chatgpt"));
      assert.equal(config.timeouts.defaultTimeoutMs, 240000);
      assert.equal(config.browser.headless, true);
      assert.equal(config.browserLaunch.automationProfilePath, path.join(cwd, "Profile 16"));
      assert.equal(config.browserLaunch.cloneAutomationProfile, true);
      assert.equal(config.extensionBridge.host, "127.0.0.1");
      assert.equal(config.extensionBridge.port, 47821);
      assert.equal(
        path.normalize(config.browserLaunch.chromeExecutablePath ?? ""),
        path.normalize("C:/Program Files/Google/Chrome/Application/chrome.exe"),
      );
    }

    {
      const cwd = await createTempDir();
      const config = loadConfig({}, cwd);

      assert.equal(config.browser.headless, false);
      assert.deepEqual(config.browserLaunch, {
        automationProfilePath: undefined,
        cloneAutomationProfile: true,
        chromeProfileDirectory: undefined,
        chromeExecutablePath: undefined,
      });
      assert.deepEqual(config.extensionBridge, {
        host: "127.0.0.1",
        port: 47821,
      });
    }

    {
      const cwd = await createTempDir();
      const config = loadConfig(
        {
          CHATGPT_CLONE_PROFILE: "false",
          CHATGPT_EXTENSION_BRIDGE_PORT: "49000",
        },
        cwd,
      );

      assert.equal(config.browserLaunch.cloneAutomationProfile, false);
      assert.equal(config.extensionBridge.port, 49000);
    }

    {
      const cwd = await createTempDir();
      assert.throws(() =>
        loadConfig(
          {
            CHATGPT_DEFAULT_TIMEOUT_MS: "abc",
          },
          cwd,
        ),
      AppError);
    }

    {
      const cwd = await createTempDir();
      assert.throws(() =>
        loadConfig(
          {
            CHATGPT_CHROME_PROFILE_DIRECTORY: "Profile 16",
          },
          cwd,
        ),
      AppError);
    }
  } finally {
    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
