import type {LeaderboardEntry} from "./pvp-model";
import {ADDRESS_PATTERN} from "./contract-config";
import {inspectReceiptExecution} from "./transaction-reconciliation";

const MAX_LEADERBOARD_ENTRIES = 100;

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function discoverFinalizedPlayers(
  value: unknown,
  contractAddress: string,
): string[] {
  if (!Array.isArray(value) || !ADDRESS_PATTERN.test(contractAddress)) {
    throw new Error("Studionet returned an invalid transaction index");
  }

  const expectedContract = contractAddress.toLowerCase();
  const players = new Set<string>();
  for (const candidate of value) {
    const transaction = objectRecord(candidate);
    if (!transaction) continue;

    const from = String(transaction.from_address ?? "");
    const to = String(transaction.to_address ?? "");
    if (
      Number(transaction.type) !== 2
      || String(transaction.status).toUpperCase() !== "FINALIZED"
      || to.toLowerCase() !== expectedContract
      || !ADDRESS_PATTERN.test(from)
      || inspectReceiptExecution(transaction).outcome !== "success"
    ) {
      continue;
    }
    players.add(from.toLowerCase());
  }
  return [...players];
}

export function rankLeaderboard(entries: readonly LeaderboardEntry[]): LeaderboardEntry[] {
  const unique = new Map<string, LeaderboardEntry>();
  for (const entry of entries) {
    if (entry.xp <= 0) continue;
    const key = entry.player.toLowerCase();
    const current = unique.get(key);
    if (!current || entry.xp > current.xp) unique.set(key, entry);
  }

  return [...unique.values()]
    .sort((left, right) =>
      right.xp - left.xp
      || right.wins - left.wins
      || right.bestStreak - left.bestStreak
      || left.player.toLowerCase().localeCompare(right.player.toLowerCase()))
    .slice(0, MAX_LEADERBOARD_ENTRIES);
}

export function parseLeaderboardPayload(value: unknown): LeaderboardEntry[] {
  const record = objectRecord(value);
  if (!record || !Array.isArray(record.entries)) {
    throw new Error("The leaderboard service returned invalid data");
  }

  const entries = record.entries.map((candidate) => {
    const entry = objectRecord(candidate);
    if (!entry) throw new Error("The leaderboard service returned an invalid entry");
    const player = String(entry.player ?? "");
    const fields = ["xp", "wins", "losses", "streak", "bestStreak"] as const;
    const values = Object.fromEntries(fields.map((field) => [field, Number(entry[field])])) as Record<typeof fields[number], number>;
    if (
      !ADDRESS_PATTERN.test(player)
      || fields.some((field) => !Number.isSafeInteger(values[field]) || values[field] < 0)
    ) {
      throw new Error("The leaderboard service returned an invalid entry");
    }
    return {player, ...values};
  });

  if (entries.length > MAX_LEADERBOARD_ENTRIES) {
    throw new Error("The leaderboard service returned too many entries");
  }
  return rankLeaderboard(entries);
}
