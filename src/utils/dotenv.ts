import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function stripOuterQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseLine(line: string): { key: string; value: string } | undefined {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return undefined;
  }

  const match = trimmed.match(/^(?:\$env:)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match) {
    return undefined;
  }

  const key = match[1];
  if (!key) {
    return undefined;
  }
  const rawValue = match[2] ?? "";
  const value = stripOuterQuotes(rawValue.trim());
  return { key, value };
}

export function loadDotEnv(cwd = process.cwd(), env: NodeJS.ProcessEnv = process.env): void {
  const envPath = path.join(cwd, ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) {
      continue;
    }

    if (env[parsed.key] === undefined) {
      env[parsed.key] = parsed.value;
    }
  }
}
