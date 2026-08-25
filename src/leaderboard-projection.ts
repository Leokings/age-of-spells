import {createClient} from "genlayer-js";
import {studionet} from "genlayer-js/chains";
import {TransactionHashVariant, type CalldataEncodable} from "genlayer-js/types";

import {DEFAULT_AGE_OF_SPELLS_PVP_CONTRACT_ADDRESS} from "./contract-config";
import {discoverFinalizedPlayers, parseLeaderboardPayload, rankLeaderboard} from "./leaderboard-ranking";
import {parsePlayerProfile, type LeaderboardEntry} from "./pvp-model";
import {retryRpc} from "./rpc-retry";

const CACHE_WINDOW_MS = 30_000;
let cachedAt = 0;
let cachedEntries: LeaderboardEntry[] | null = null;
let inFlight: Promise<LeaderboardEntry[]> | null = null;

async function projectDirectly(contractAddress: `0x${string}`): Promise<LeaderboardEntry[]> {
  const client = createClient({chain: studionet});
  const transactions = await retryRpc("leaderboard transaction index", () =>
    client.request({
      method: "sim_getTransactionsForAddress",
      params: [contractAddress],
    }));
  const players = discoverFinalizedPlayers(transactions, contractAddress);
  const profiles: LeaderboardEntry[] = [];

  // Studionet is deliberately rate-limited. Sequential finalized reads are
  // slower on a cold projection, but avoid turning ranking into an RPC burst.
  for (const player of players) {
    const raw = await retryRpc("leaderboard profile read", () =>
      client.readContract({
        address: contractAddress,
        functionName: "get_profile",
        args: [player] as CalldataEncodable[],
        transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
      }));
    profiles.push(parsePlayerProfile(raw));
  }
  return rankLeaderboard(profiles);
}

export function projectStudionetLeaderboard(
  contractAddress: `0x${string}` = DEFAULT_AGE_OF_SPELLS_PVP_CONTRACT_ADDRESS,
): Promise<LeaderboardEntry[]> {
  return projectDirectly(contractAddress);
}

async function readApplicationProjection(): Promise<LeaderboardEntry[]> {
  const response = await fetch("/api/leaderboard", {
    headers: {Accept: "application/json"},
  });
  if (!response.ok) throw new LeaderboardServiceError(response.status);
  return parseLeaderboardPayload(await response.json());
}

class LeaderboardServiceError extends Error {
  constructor(readonly status: number) {
    super(`Leaderboard service returned ${status}`);
    this.name = "LeaderboardServiceError";
  }
}

export function loadGlobalLeaderboard(
  contractAddress: `0x${string}` = DEFAULT_AGE_OF_SPELLS_PVP_CONTRACT_ADDRESS,
): Promise<LeaderboardEntry[]> {
  const now = Date.now();
  if (cachedEntries && now - cachedAt < CACHE_WINDOW_MS) {
    return Promise.resolve(cachedEntries);
  }
  if (inFlight) return inFlight;

  inFlight = readApplicationProjection()
    .catch((cause) => {
      // Vite's local development server does not mount Vercel Functions, so a
      // missing endpoint may safely fall back to the same read-only projection
      // in the browser. A production 5xx is deliberately surfaced instead of
      // turning every visitor into another burst of Studionet RPC requests.
      if (cause instanceof LeaderboardServiceError && cause.status !== 404) throw cause;
      return projectDirectly(contractAddress);
    })
    .then((entries) => {
      cachedEntries = entries;
      cachedAt = Date.now();
      return entries;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
