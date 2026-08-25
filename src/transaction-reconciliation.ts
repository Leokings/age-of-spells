export type ReceiptExecution = {
  outcome: "success" | "failure" | "unknown";
  detail?: string;
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function firstString(source: UnknownRecord | null, ...keys: string[]): string {
  if (!source) return "";
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function leaderReceipts(receipt: UnknownRecord): UnknownRecord[] {
  const consensus =
    record(receipt.consensus_data) ??
    record(receipt.consensusData);
  if (!consensus) return [];

  const raw = consensus.leader_receipt ?? consensus.leaderReceipt;
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return values.map(record).filter((value): value is UnknownRecord => Boolean(value));
}

function receiptFailureDetail(receipt: UnknownRecord): string | undefined {
  const genvm = record(receipt.genvm_result) ?? record(receipt.genvmResult);
  return firstString(
    genvm,
    "error_description",
    "errorDescription",
    "stderr",
    "error_code",
    "errorCode",
  ) || undefined;
}

/**
 * GenLayer testnets expose two receipt shapes:
 * - consensus-chain receipts use `txExecutionResultName`;
 * - Studio/Studionet receipts expose `consensus_data.leader_receipt[].execution_result`.
 *
 * A finalized lifecycle status is intentionally not treated as execution success.
 */
export function inspectReceiptExecution(value: unknown): ReceiptExecution {
  const receipt = record(value);
  if (!receipt) return {outcome: "unknown"};

  const topLevel = firstString(
    receipt,
    "txExecutionResultName",
    "tx_execution_result_name",
  ).toUpperCase();
  if (topLevel === "FINISHED_WITH_RETURN" || topLevel === "SUCCESS") {
    return {outcome: "success"};
  }
  if (topLevel === "FINISHED_WITH_ERROR" || topLevel === "ERROR" || topLevel === "FAILURE") {
    return {
      outcome: "failure",
      detail: receiptFailureDetail(receipt),
    };
  }

  const leaders = leaderReceipts(receipt);
  for (const leader of leaders) {
    const execution = firstString(
      leader,
      "execution_result",
      "executionResult",
    ).toUpperCase();
    if (execution === "SUCCESS" || execution === "FINISHED_WITH_RETURN") {
      return {outcome: "success"};
    }
  }
  for (const leader of leaders) {
    const execution = firstString(
      leader,
      "execution_result",
      "executionResult",
    ).toUpperCase();
    if (execution === "ERROR" || execution === "FAILURE" || execution === "FINISHED_WITH_ERROR") {
      return {
        outcome: "failure",
        detail: receiptFailureDetail(leader),
      };
    }
  }

  return {outcome: "unknown"};
}

export function matchStateChanged(
  previous: {matchId: string; revision: number} | null | undefined,
  next: {matchId: string; revision: number} | null,
): boolean {
  if (!next) return false;
  if (previous === undefined) return false;
  if (previous === null) return true;
  return next.matchId !== previous.matchId || next.revision !== previous.revision;
}
