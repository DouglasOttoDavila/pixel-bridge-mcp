import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

export async function loadOrCreateBridgeToken(cwd: string): Promise<string> {
  const tokenDirectory = path.join(cwd, ".mcp-chatgpt-extension");
  const tokenPath = path.join(tokenDirectory, "bridge-token.txt");

  if (existsSync(tokenPath)) {
    return (await readFile(tokenPath, "utf8")).trim();
  }

  await mkdir(tokenDirectory, { recursive: true });
  const token = randomUUID();
  await writeFile(tokenPath, `${token}\n`, "utf8");
  return token;
}
