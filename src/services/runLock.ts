import { AppError } from "../errors.js";

interface LockHandle {
  key: string;
  token: symbol;
}

export class RunLockService {
  private readonly activeLocks = new Map<string, LockHandle>();

  public acquire(key: string): LockHandle {
    if (this.activeLocks.has(key)) {
      throw new AppError("RUN_LOCKED", "A browser run is already active for this profile.", {
        details: { key },
      });
    }

    const handle: LockHandle = {
      key,
      token: Symbol(key),
    };

    this.activeLocks.set(key, handle);
    return handle;
  }

  public release(handle: LockHandle): void {
    const active = this.activeLocks.get(handle.key);
    if (active?.token === handle.token) {
      this.activeLocks.delete(handle.key);
    }
  }

  public async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const handle = this.acquire(key);
    try {
      return await fn();
    } finally {
      this.release(handle);
    }
  }
}
