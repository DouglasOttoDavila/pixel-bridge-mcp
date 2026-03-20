import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadDotEnv } from "../src/utils/dotenv.js";

export async function runDotEnvTests(): Promise<void> {
  const tempDirs: string[] = [];
  const createTempDir = async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "chatgpt-browser-mcp-dotenv-"));
    tempDirs.push(dir);
    return dir;
  };

  try {
    {
      const cwd = await createTempDir();
      await writeFile(
        path.join(cwd, ".env"),
        [
          'CHATGPT_AUTOMATION_PROFILE_PATH="C:\\Users\\dougl\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 16"',
          '$env:CHATGPT_BROWSER_HEADLESS="false"',
          "# comment",
          "",
        ].join("\n"),
      );

      const env: NodeJS.ProcessEnv = {};
      loadDotEnv(cwd, env);

      assert.equal(env.CHATGPT_AUTOMATION_PROFILE_PATH, "C:\\Users\\dougl\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 16");
      assert.equal(env.CHATGPT_BROWSER_HEADLESS, "false");
    }

    {
      const cwd = await createTempDir();
      await writeFile(
        path.join(cwd, ".env"),
        'CHATGPT_BROWSER_HEADLESS="false"\n',
      );

      const env: NodeJS.ProcessEnv = {
        CHATGPT_BROWSER_HEADLESS: "true",
      };
      loadDotEnv(cwd, env);

      assert.equal(env.CHATGPT_BROWSER_HEADLESS, "true");
    }

    {
      const cwd = await createTempDir();
      const runtimeHome = await createTempDir();
      await writeFile(path.join(runtimeHome, ".env"), 'CHATGPT_EXTENSION_BRIDGE_PORT="47899"\n');
      await writeFile(path.join(cwd, ".env"), 'CHATGPT_BROWSER_HEADLESS="false"\n');

      const env: NodeJS.ProcessEnv = {};
      loadDotEnv([cwd, runtimeHome], env);

      assert.equal(env.CHATGPT_BROWSER_HEADLESS, "false");
      assert.equal(env.CHATGPT_EXTENSION_BRIDGE_PORT, "47899");
    }
  } finally {
    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
