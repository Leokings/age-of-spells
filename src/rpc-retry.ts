export type RpcRetryOptions = {
  attempts?: number;
  delayMs?: (retryNumber: number) => number;
  logger?: (message: string, details: Record<string, unknown>) => void;
};

const DEFAULT_DELAYS_MS = [500, 1_500, 3_000, 5_000];

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function nestedErrorCode(cause: unknown): number | undefined {
  if (cause === null || typeof cause !== "object") return undefined;
  const error = cause as {code?: unknown; cause?: unknown};
  if (typeof error.code === "number") return error.code;
  return nestedErrorCode(error.cause);
}

export function isRpcRateLimitError(cause: unknown): boolean {
  const code = nestedErrorCode(cause);
  return (
    code === 429 ||
    code === -32_429 ||
    /rate.?limit|too many requests|http 429/i.test(errorMessage(cause))
  );
}

export function studionetRateLimitMessage(action: string): string {
  return (
    `Studionet is rate-limiting ${action}. Wait about 60 seconds before ` +
    "trying again."
  );
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
}

export async function retryRpc<T>(
  stage: string,
  operation: () => Promise<T>,
  options: RpcRetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 5;
  if (!Number.isSafeInteger(attempts) || attempts < 1) {
    throw new Error("RPC retry attempts must be a positive integer");
  }

  const delayMs =
    options.delayMs ??
    ((retryNumber: number) =>
      DEFAULT_DELAYS_MS[
        Math.min(retryNumber - 1, DEFAULT_DELAYS_MS.length - 1)
      ]);
  const logger = options.logger ?? console.warn;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (cause) {
      // Retrying during the same quota window only extends the outage and can
      // prevent the next user-initiated transaction from being accepted.
      if (isRpcRateLimitError(cause)) {
        throw new Error(studionetRateLimitMessage(stage), {cause});
      }
      if (attempt === attempts) {
        throw new Error(
          `${stage} failed after ${attempts} attempts: ${errorMessage(cause)}`,
          {cause},
        );
      }

      const retryDelay = Math.max(0, delayMs(attempt));
      logger(`[Age of Spells RPC] ${stage} failed; retrying`, {
        attempt,
        attempts,
        retryDelay,
        error: errorMessage(cause),
      });
      await wait(retryDelay);
    }
  }

  throw new Error(`${stage} failed unexpectedly`);
}
