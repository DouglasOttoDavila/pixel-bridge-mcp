import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";

export interface ResolvedProfileLocation {
  userDataDir: string;
  profileDirectory?: string;
}

export function resolveProfileLocation(
  profilePath: string,
  explicitProfileDirectory?: string,
): ResolvedProfileLocation {
  const baseName = path.basename(profilePath);
  const looksLikeProfileDirectory =
    baseName === "Default" || /^Profile \d+$/i.test(baseName);

  if (looksLikeProfileDirectory) {
    return {
      userDataDir: path.dirname(profilePath),
      profileDirectory: baseName,
    };
  }

  return {
    userDataDir: profilePath,
    profileDirectory: explicitProfileDirectory,
  };
}

export async function prepareAutomationProfileLocation(
  profilePath: string,
  explicitProfileDirectory: string | undefined,
  cwd: string,
): Promise<ResolvedProfileLocation> {
  const resolved = resolveProfileLocation(profilePath, explicitProfileDirectory);
  if (!shouldCloneForAutomation(profilePath, resolved)) {
    return resolved;
  }

  const cloneRoot = buildAutomationCloneRoot(cwd, profilePath, resolved.profileDirectory);
  const markerPath = path.join(cloneRoot, ".mcp-profile-source.json");
  if (existsSync(markerPath)) {
    const marker = await readCloneMarker(markerPath);
    if (marker?.mode === "profile-as-root") {
      return {
        userDataDir: cloneRoot,
        profileDirectory: undefined,
      };
    }
  }

  const sourceProfilePath = resolved.profileDirectory
    ? path.join(resolved.userDataDir, resolved.profileDirectory)
    : resolved.userDataDir;

  await rm(cloneRoot, { recursive: true, force: true });
  await mkdir(cloneRoot, { recursive: true });

  await cp(sourceProfilePath, cloneRoot, {
    recursive: true,
    filter: (source) => shouldCopyChromeProfilePath(source),
  });

  await writeFile(
    markerPath,
    `${JSON.stringify({
      mode: "profile-as-root",
      sourceProfilePath,
      sourceUserDataDir: resolved.userDataDir,
      profileDirectory: resolved.profileDirectory,
    }, null, 2)}\n`,
    "utf8",
  );

  return {
    userDataDir: cloneRoot,
    profileDirectory: undefined,
  };
}

export async function prepareChromeUserDataDir(
  profilePath: string,
  explicitProfileDirectory: string | undefined,
  cwd: string,
): Promise<ResolvedProfileLocation> {
  const resolved = resolveProfileLocation(profilePath, explicitProfileDirectory);
  if (!shouldCloneChromeUserDataDir(profilePath, resolved)) {
    return resolved;
  }

  let cloneRoot = buildAutomationCloneRoot(cwd, profilePath, resolved.profileDirectory);
  const targetProfileDirectory = resolved.profileDirectory ?? "Default";
  const markerPath = path.join(cloneRoot, ".mcp-profile-source.json");
  const sourceProfilePath = resolved.profileDirectory
    ? path.join(resolved.userDataDir, resolved.profileDirectory)
    : profilePath;

  try {
    await rm(cloneRoot, { recursive: true, force: true });
  } catch (error) {
    if (!isBusyFsError(error)) {
      throw error;
    }

    cloneRoot = `${cloneRoot}-${Date.now().toString(36)}`;
  }

  await mkdir(path.join(cloneRoot, targetProfileDirectory), { recursive: true });

  await cp(sourceProfilePath, path.join(cloneRoot, targetProfileDirectory), {
    recursive: true,
    filter: (source) => shouldCopyChromeProfilePath(source),
  });

  const localStatePath = path.join(resolved.userDataDir, "Local State");
  if (existsSync(localStatePath)) {
    await cp(localStatePath, path.join(cloneRoot, "Local State"));
  }

  await writeFile(
    markerPath,
    `${JSON.stringify({
      mode: "playwright-user-data",
      sourceProfilePath,
      sourceUserDataDir: resolved.userDataDir,
      sourceProfileDirectory: resolved.profileDirectory,
      profileDirectory: targetProfileDirectory,
    }, null, 2)}\n`,
    "utf8",
  );

  return {
    userDataDir: cloneRoot,
    profileDirectory: targetProfileDirectory,
  };
}

export function shouldCloneForAutomation(
  profilePath: string,
  resolved: ResolvedProfileLocation,
): boolean {
  const sourcePath = resolved.profileDirectory
    ? path.join(resolved.userDataDir, resolved.profileDirectory)
    : profilePath;

  return isWithinChromeDefaultUserData(sourcePath);
}

export function shouldCloneChromeUserDataDir(
  profilePath: string,
  resolved: ResolvedProfileLocation,
): boolean {
  return resolved.profileDirectory !== undefined && shouldCloneForAutomation(profilePath, resolved);
}

export function buildAutomationCloneRoot(
  cwd: string,
  profilePath: string,
  profileDirectory?: string,
): string {
  const key = `${path.resolve(profilePath)}|${profileDirectory ?? ""}`;
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 12);
  const baseName = path.basename(profilePath) || "default";
  const name = profileDirectory !== undefined ? profileDirectory : baseName;
  return path.join(cwd, ".mcp-chatgpt-chrome", `${sanitizeSegment(name)}-${hash}`);
}

function sanitizeSegment(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "profile";
}

function isWithinChromeDefaultUserData(inputPath: string): boolean {
  const normalized = path.normalize(inputPath).toLowerCase();
  const marker = path.normalize(path.join("google", "chrome", "user data")).toLowerCase();
  return normalized.includes(marker);
}

function shouldCopyChromeProfilePath(source: string): boolean {
  const baseName = path.basename(source).toLowerCase();
  if (baseName === "singletonlock" || baseName === "singletonsocket" || baseName === "singletoncookie") {
    return false;
  }

  if (baseName.endsWith(".tmp") || baseName.endsWith(".log")) {
    return false;
  }

  return ![
    "cache",
    "code cache",
    "gpucache",
    "grshadercache",
    "dawngraphitecache",
    "dawnwebgpucache",
    "shadercache",
    "crashpad",
  ].includes(baseName);
}

async function readCloneMarker(markerPath: string): Promise<{ mode?: string } | undefined> {
  try {
    const raw = await readFile(markerPath, "utf8");
    return JSON.parse(raw) as { mode?: string };
  } catch {
    return undefined;
  }
}

function isBusyFsError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EBUSY";
}

export function looksLikeImageFileName(urlOrPath: string): string | undefined {
  const fileName = urlOrPath.split("/").pop()?.split("?")[0];
  if (!fileName) {
    return undefined;
  }

  return /\.(png|jpe?g|webp|gif)$/i.test(fileName) ? fileName : undefined;
}
