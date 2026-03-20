export type AppErrorCode =
  | "INVALID_CONFIG"
  | "UNAUTHENTICATED_SESSION"
  | "GPT_RESOLUTION_FAILED"
  | "BACKEND_FALLBACK_FAILED"
  | "GENERATION_TIMEOUT"
  | "PERSISTENCE_FAILED"
  | "RUN_LOCKED"
  | "AUTOMATION_FAILURE"
  | "EXTENSION_NOT_CONNECTED"
  | "NO_ACTIVE_CHATGPT_TAB"
  | "ACTIVE_TAB_MISMATCH"
  | "BRIDGE_TIMEOUT"
  | "PAGE_CONTEXT_INVALID"
  | "PROMPT_SUBMISSION_FAILED"
  | "IMAGE_NOT_FOUND";

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly retryable: boolean;
  public readonly details?: unknown;

  public constructor(
    code: AppErrorCode,
    message: string,
    options?: {
      retryable?: boolean;
      details?: unknown;
      cause?: unknown;
    },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

export function asAppError(
  error: unknown,
  fallbackCode: AppErrorCode = "AUTOMATION_FAILURE",
): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(fallbackCode, error.message, {
      cause: error,
      details: { name: error.name },
    });
  }

  return new AppError(fallbackCode, "Unknown automation failure.", {
    details: { value: error },
  });
}

function firstNonEmptyLine(value: string): string | undefined {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}

export function getErrorCauseSummary(error: unknown): string | undefined {
  if (!(error instanceof Error) || error.cause === undefined) {
    return undefined;
  }

  const cause = error.cause;
  if (cause instanceof Error) {
    return firstNonEmptyLine(cause.message) ?? firstNonEmptyLine(String(cause));
  }

  if (typeof cause === "string") {
    return firstNonEmptyLine(cause);
  }

  return undefined;
}

export function isRetryableError(error: unknown): boolean {
  return error instanceof AppError && error.retryable;
}
