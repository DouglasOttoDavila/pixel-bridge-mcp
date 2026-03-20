import { AppError, isRetryableError } from "../errors.js";
import { sleep } from "./time.js";

export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const shouldRetry = options.shouldRetry ?? defaultShouldRetry;

      if (attempt >= options.attempts || !shouldRetry(error, attempt)) {
        throw error;
      }

      await sleep(options.baseDelayMs * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new AppError("AUTOMATION_FAILURE", "Retry exhausted without a concrete error.");
}

function defaultShouldRetry(error: unknown): boolean {
  return isRetryableError(error);
}
