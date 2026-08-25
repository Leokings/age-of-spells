import {defineChain} from "viem";

export const STUDIONET_CHAIN_ID = 61_999;
export const STUDIONET_RPC_URL = "https://studio.genlayer.com/api";
export const STUDIONET_EXPLORER_URL =
  "https://explorer-studio.genlayer.com";

export const privyStudionet = defineChain({
  id: STUDIONET_CHAIN_ID,
  name: "GenLayer Studionet",
  network: "genlayer-studionet",
  nativeCurrency: {
    name: "GEN",
    symbol: "GEN",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [STUDIONET_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "GenLayer Studionet Explorer",
      url: STUDIONET_EXPLORER_URL,
    },
  },
  testnet: true,
});
