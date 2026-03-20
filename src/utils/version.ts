import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let cachedVersion: string | undefined;

export function getPackageVersion(fallback = "0.1.0"): string {
  if (cachedVersion) {
    return cachedVersion;
  }

  try {
    const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
    const packageJsonPath = path.resolve(currentDirectory, "..", "..", "package.json");
    const raw = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: unknown };
    if (typeof raw.version === "string" && raw.version.trim()) {
      cachedVersion = raw.version.trim();
      return cachedVersion;
    }
  } catch {
    // Fallback to the provided version if package.json cannot be read at runtime.
  }

  cachedVersion = fallback;
  return cachedVersion;
}

export function areVersionsCompatible(expected: string | undefined, actual: string | undefined): boolean {
  if (!expected || !actual) {
    return true;
  }

  return expected.trim() === actual.trim();
}
