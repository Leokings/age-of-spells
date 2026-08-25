import {createClient} from "genlayer-js";
import {studionet} from "genlayer-js/chains";
import {
  TransactionHashVariant,
  TransactionStatus,
  type CalldataEncodable,
  type Hash,
} from "genlayer-js/types";

import {
  parseLobby,
  parseMatchState,
  parsePlayerProfile,
  type MatchState,
  type PvpAdapter,
} from "./pvp-model";
import {
  ADDRESS_PATTERN,
  DEFAULT_AGE_OF_SPELLS_PVP_CONTRACT_ADDRESS,
} from "./contract-config";
import {loadGlobalLeaderboard} from "./leaderboard-projection";
import {isRpcRateLimitError, retryRpc, studionetRateLimitMessage} from "./rpc-retry";
import {inspectReceiptExecution, matchStateChanged} from "./transaction-reconciliation";
import {getStudionetProvider, type ConnectedWallet} from "./wallet-network";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const configuredAddress =
  import.meta.env.VITE_AGE_OF_SPELLS_PVP_CONTRACT_ADDRESS?.trim()
  || import.meta.env.VITE_AGE_OF_SPELLS_PVP_V3_CONTRACT_ADDRESS?.trim()
  || DEFAULT_AGE_OF_SPELLS_PVP_CONTRACT_ADDRESS;

if (!ADDRESS_PATTERN.test(configuredAddress)) {
  throw new Error("VITE_AGE_OF_SPELLS_PVP_CONTRACT_ADDRESS is not a valid address");
}

export const AGE_OF_SPELLS_PVP_CONTRACT_ADDRESS = configuredAddress as `0x${string}`;
export const HAS_PVP_DEPLOYMENT = configuredAddress.toLowerCase() !== ZERO_ADDRESS;

export type PvpTransactionCallbacks = {
  onSubmitted?: (hash: Hash, action: string) => void;
};

export class SubmittedPvpTransactionError extends Error {
  readonly transactionHash: Hash;

  constructor(hash: Hash, cause: unknown) {
    super(
      `Transaction ${hash} is still reconciling on Studionet. ` +
        "Its hash is preserved; Refresh will load the finalized match state.",
      {cause},
    );
    this.name = "SubmittedPvpTransactionError";
    this.transactionHash = hash;
  }
}

class PvpExecutionFailure extends Error {
  constructor(detail?: string) {
    super(detail || "The PvP transaction finalized with a contract execution error");
    this.name = "PvpExecutionFailure";
  }
}

function requirePvpAddress(): `0x${string}` {
  if (!HAS_PVP_DEPLOYMENT) {
    throw new Error("The AgeOfSpellsPvP contract has not been deployed to Studionet yet");
  }
  return AGE_OF_SPELLS_PVP_CONTRACT_ADDRESS;
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
}

export function createStudionetPvpAdapter(
  wallet: ConnectedWallet,
  callbacks: PvpTransactionCallbacks = {},
): PvpAdapter {
  let lastKnownMatch: MatchState | null | undefined;

  async function readOnce(functionName: string, args: CalldataEncodable[] = []) {
    const client = createClient({chain: studionet});
    return client.readContract({
      address: requirePvpAddress(),
      functionName,
      args,
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    });
  }

  async function read(functionName: string, args: CalldataEncodable[] = []) {
    return retryRpc(`${functionName} read`, () => readOnce(functionName, args));
  }

  async function readMatch(): Promise<MatchState | null> {
    const next = parseMatchState(await read("get_player_match", [wallet.address]));
    lastKnownMatch = next;
    return next;
  }

  async function readMatchOnce(): Promise<MatchState | null> {
    return parseMatchState(await readOnce("get_player_match", [wallet.address]));
  }

  async function reconcileSubmittedWrite(
    client: ReturnType<typeof createClient>,
    hash: Hash,
    functionName: string,
    previous: MatchState | null | undefined,
  ): Promise<MatchState> {
    const attempts = 60;
    const intervalMs = 4_000;
    const deadline = Date.now() + 5 * 60_000;
    let lastCause: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      let receiptSucceeded = false;
      let retryDelayMs = intervalMs;
      let skipStateRead = false;
      try {
        const receipt = await client.waitForTransactionReceipt({
          hash,
          status: TransactionStatus.FINALIZED,
          interval: 0,
          retries: 0,
        });
        const execution = inspectReceiptExecution(receipt);
        if (execution.outcome === "failure") {
          throw new PvpExecutionFailure(execution.detail);
        }
        receiptSucceeded = execution.outcome === "success";
      } catch (cause) {
        if (cause instanceof PvpExecutionFailure) throw cause;
        lastCause = cause;
        if (isRpcRateLimitError(cause)) {
          retryDelayMs = 60_000;
          skipStateRead = true;
        }
      }

      if (!skipStateRead) {
        try {
          const next = await readMatchOnce();
          const finalizedStateChanged = matchStateChanged(previous, next);
          const firstKnownStateAfterSuccess =
            previous === undefined && receiptSucceeded && next !== null;
          const recoveredCreation =
            previous === undefined &&
            functionName === "create_match" &&
            next?.status === "waiting";

          if (next && (finalizedStateChanged || firstKnownStateAfterSuccess || recoveredCreation)) {
            lastKnownMatch = next;
            return next;
          }
        } catch (cause) {
          lastCause = cause;
          if (isRpcRateLimitError(cause)) retryDelayMs = 60_000;
        }
      }

      const remainingMs = deadline - Date.now();
      if (attempt >= attempts || remainingMs <= 0) break;
      await wait(Math.min(retryDelayMs, remainingMs));
    }

    throw new SubmittedPvpTransactionError(hash, lastCause);
  }

  async function write(
    functionName: string,
    args: CalldataEncodable[] = [],
  ): Promise<MatchState> {
    const previous = lastKnownMatch;
    const provider = await getStudionetProvider(wallet);
    const client = createClient({
      chain: studionet,
      account: wallet.address as `0x${string}`,
      provider,
    });
    let hash: Hash;
    try {
      hash = await client.writeContract({
        address: requirePvpAddress(),
        functionName,
        args,
        value: 0n,
      });
    } catch (cause) {
      if (isRpcRateLimitError(cause)) {
        throw new Error(studionetRateLimitMessage("PvP actions"), {cause});
      }
      throw cause;
    }

    callbacks.onSubmitted?.(hash, functionName);
    return reconcileSubmittedWrite(client, hash, functionName, previous);
  }

  return {
    getMatch: readMatch,
    async getLobby() {
      return parseLobby(await read("get_lobby", [wallet.address]));
    },
    async getProfile() {
      return parsePlayerProfile(await read("get_profile", [wallet.address]));
    },
    async getLeaderboard() {
      return loadGlobalLeaderboard(AGE_OF_SPELLS_PVP_CONTRACT_ADDRESS);
    },
    createMatch: (invitedPlayer) => write("create_match", [invitedPlayer]),
    joinMatch: (matchId) => write("join_match", [matchId]),
    cancelMatch: () => write("cancel_match"),
    forgeAndCast: (ingredients, incantation) => {
      if (ingredients.length < 2 || ingredients.length > 3) {
        throw new Error("fusion_requires_two_or_three_cards");
      }
      const [firstIngredient, secondIngredient, thirdIngredient = ""] = ingredients;
      return write("forge_and_cast", [
        firstIngredient,
        secondIngredient,
        thirdIngredient,
        incantation,
      ]);
    },
    buyPack: (tier) => write("buy_pack", [tier]),
    focusTurn: () => write("focus_turn"),
    concedeMatch: () => write("concede_match"),
  };
}
