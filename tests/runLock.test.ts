import assert from "node:assert/strict";
import { RunLockService } from "../src/services/runLock.js";

export async function runRunLockTests(): Promise<void> {
  {
    const lock = new RunLockService();
    const value = await lock.runExclusive("profile", async () => "ok");
    assert.equal(value, "ok");

    assert.equal(await lock.runExclusive("profile", async () => "again"), "again");
  }

  {
    const lock = new RunLockService();
    const hold = lock.runExclusive("profile", async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    await assert.rejects(
      () => lock.runExclusive("profile", async () => undefined),
      /A browser run is already active for this profile./,
    );

    await hold;
  }

  {
    const lock = new RunLockService();

    await assert.rejects(
      () =>
        lock.runExclusive("profile", async () => {
          throw new Error("boom");
        }),
      /boom/,
    );

    assert.equal(await lock.runExclusive("profile", async () => "recovered"), "recovered");
  }
}
