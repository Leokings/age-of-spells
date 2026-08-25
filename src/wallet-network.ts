import type {EIP1193Provider} from "viem";

import {
  STUDIONET_CHAIN_ID,
  STUDIONET_EXPLORER_URL,
  STUDIONET_RPC_URL,
} from "./studionet";

export type WalletNetworkClient = {
  switchChain: (chainId: number) => Promise<void>;
  getEthereumProvider: () => Promise<EIP1193Provider>;
  chainId?: string;
  walletClientType?: string;
  connectorType?: string;
  meta?: {name?: string};
};

export type ConnectedWallet = WalletNetworkClient & {
  address: string;
};

const STUDIONET_CHAIN_ID_HEX =
  `0x${STUDIONET_CHAIN_ID.toString(16)}` as `0x${string}`;

function getErrorCode(cause: unknown): number | undefined {
  if (cause === null || typeof cause !== "object") return undefined;
  const error = cause as {code?: unknown; cause?: unknown};
  if (typeof error.code === "number") return error.code;
  return getErrorCode(error.cause);
}

function getErrorMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  return String(cause);
}

function wasRejectedByUser(cause: unknown): boolean {
  return (
    getErrorCode(cause) === 4001 ||
    /user rejected|rejected the request|user denied/i.test(getErrorMessage(cause))
  );
}

function walletName(wallet: WalletNetworkClient): string {
  return wallet.meta?.name || wallet.walletClientType || "connected wallet";
}

function parseWalletChainId(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const rawValue = value.includes(":") ? value.slice(value.lastIndexOf(":") + 1) : value;
  try {
    const chainId = rawValue.startsWith("0x")
      ? Number(BigInt(rawValue))
      : Number(rawValue);
    return Number.isSafeInteger(chainId) ? chainId : undefined;
  } catch {
    return undefined;
  }
}

async function openProvider(
  wallet: WalletNetworkClient,
  phase: "fallback" | "refresh",
): Promise<EIP1193Provider> {
  try {
    return await wallet.getEthereumProvider();
  } catch (cause) {
    const action =
      phase === "fallback"
        ? "open its provider for the add-network fallback"
        : "refresh its provider after switching networks";
    throw new Error(
      `${walletName(wallet)} could not ${action} (${phase}): ${getErrorMessage(cause)}`,
    );
  }
}

async function getProviderChainId(provider: EIP1193Provider): Promise<number> {
  const rawChainId = await provider.request({method: "eth_chainId"});
  const chainId =
    typeof rawChainId === "string" ? Number(BigInt(rawChainId)) : Number(rawChainId);
  if (!Number.isSafeInteger(chainId)) {
    throw new Error("Wallet provider returned an invalid chain ID");
  }
  return chainId;
}

async function registerAndSwitchExternalWallet(
  provider: EIP1193Provider,
): Promise<void> {
  await provider.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: STUDIONET_CHAIN_ID_HEX,
        chainName: "GenLayer Studionet",
        nativeCurrency: {
          name: "GEN",
          symbol: "GEN",
          decimals: 18,
        },
        rpcUrls: [STUDIONET_RPC_URL],
        blockExplorerUrls: [STUDIONET_EXPLORER_URL],
      },
    ],
  });
  await provider.request({
    method: "wallet_switchEthereumChain",
    params: [{chainId: STUDIONET_CHAIN_ID_HEX}],
  });
}

export async function getStudionetProvider(
  wallet: WalletNetworkClient,
): Promise<EIP1193Provider> {
  // Privy can fail to construct a provider while an external wallet is still on
  // an unsupported chain. Use its CAIP-2 chain hint first and request a provider
  // only after the supported-chain switch has run.
  if (parseWalletChainId(wallet.chainId) === STUDIONET_CHAIN_ID) {
    return openProvider(wallet, "refresh");
  }

  try {
    await wallet.switchChain(STUDIONET_CHAIN_ID);
  } catch (switchCause) {
    if (wasRejectedByUser(switchCause)) {
      throw new Error("The Studionet network request was rejected in your wallet.");
    }

    const provider = await openProvider(wallet, "fallback");
    try {
      await registerAndSwitchExternalWallet(provider);
    } catch (registrationCause) {
      if (wasRejectedByUser(registrationCause)) {
        throw new Error("Adding GenLayer Studionet was rejected in your wallet.");
      }
      throw new Error(
        `${walletName(wallet)} could not add or select GenLayer Studionet. ` +
          `Privy switch: ${getErrorMessage(switchCause)}. ` +
          `Wallet fallback: ${getErrorMessage(registrationCause)}`,
      );
    }
  }

  // Privy documents that an existing provider can retain the previous chain after
  // switching, so always request a fresh instance before verifying the result.
  const provider = await openProvider(wallet, "refresh");
  let chainId: number;
  try {
    chainId = await getProviderChainId(provider);
  } catch (cause) {
    throw new Error(
      `${walletName(wallet)} switched, but its refreshed provider could not report ` +
        `the active chain (eth_chainId): ${getErrorMessage(cause)}`,
    );
  }
  if (chainId !== STUDIONET_CHAIN_ID) {
    throw new Error(
      `Wallet is on chain ${chainId}, not Studionet ${STUDIONET_CHAIN_ID}`,
    );
  }
  return provider;
}
