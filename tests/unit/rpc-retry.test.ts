import assert from "node:assert/strict";

import {retryRpc} from "../../src/rpc-retry";

async function testRetriesTransientFailure(): Promise<void> {
  let calls = 0;
  const retries: number[] = [];
  const result = await retryRpc(
    "receipt read",
    async () => {
      calls += 1;
      if (calls < 3) throw new TypeError("Failed to fetch");
      return "finalized";
    },
    {
      attempts: 4,
      delayMs: () => 0,
      logger: (_message, details) => retries.push(Number(details.attempt)),
    },
  );

  assert.equal(result, "finalized");
  assert.equal(calls, 3);
  assert.deepEqual(retries, [1, 2]);
}

async function testNamesFailedStageAfterExhaustion(): Promise<void> {
  let calls = 0;
  await assert.rejects(
    retryRpc(
      "player state read",
      async () => {
        calls += 1;
        throw new Error("RPC offline");
      },
      {attempts: 3, delayMs: () => 0, logger: () => undefined},
    ),
    /player state read failed after 3 attempts: RPC offline/i,
  );
  assert.equal(calls, 3);
}

async function testRateLimitIsNotRetried(): Promise<void> {
  let calls = 0;
  await assert.rejects(
    retryRpc(
      "player state read",
      async () => {
        calls += 1;
        throw Object.assign(new Error("Request is being rate limited"), {
          code: -32_429,
        });
      },
      {attempts: 4, delayMs: () => 0, logger: () => undefined},
    ),
    /wait about 60 seconds/i,
  );
  assert.equal(calls, 1);
}

await testRetriesTransientFailure();
await testNamesFailedStageAfterExhaustion();
await testRateLimitIsNotRetried();
console.log("RPC retry tests passed");
