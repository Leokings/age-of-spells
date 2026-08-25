import assert from "node:assert/strict";

import {getStudionetProvider} from "../../src/wallet-network";

type RpcRequest = {
  method: string;
  params?: readonly unknown[];
};

type RpcCall = RpcRequest;

async function testGenericSwitchFailureAddsStudionet(): Promise<void> {
  const calls: RpcCall[] = [];
  let activeChainId = 1;
  const provider = {
    async request({method, params}: RpcRequest): Promise<unknown> {
      calls.push({method, params});
      if (method === "eth_chainId") return `0x${activeChainId.toString(16)}`;
      if (method === "wallet_addEthereumChain") return null;
      if (method === "wallet_switchEthereumChain") {
        const chain = params?.[0] as {chainId: `0x${string}`};
        activeChainId = Number(BigInt(chain.chainId));
        return null;
      }
      throw new Error(`Unexpected method: ${method}`);
    },
  };
  const switchFailure = Object.assign(new Error("execution failed"), {code: -32000});

  const result = await getStudionetProvider({
    switchChain: async () => {
      throw switchFailure;
    },
    getEthereumProvider: async () => provider as never,
  });

  assert.equal(result, provider);
  assert.equal(activeChainId, 61_999);
  assert.deepEqual(
    calls.map(({method}) => method),
    [
      "wallet_addEthereumChain",
      "wallet_switchEthereumChain",
      "eth_chainId",
    ],
  );
  const addCall = calls.find(({method}) => method === "wallet_addEthereumChain");
  assert.deepEqual(addCall?.params?.[0], {
    chainId: "0xf22f",
    chainName: "GenLayer Studionet",
    nativeCurrency: {name: "GEN", symbol: "GEN", decimals: 18},
    rpcUrls: ["https://studio.genlayer.com/api"],
    blockExplorerUrls: ["https://explorer-studio.genlayer.com"],
  });
}

async function testSwitchRunsBeforeProviderCreation(): Promise<void> {
  let switchFinished = false;
  const provider = {
    async request({method}: RpcRequest): Promise<unknown> {
      if (method === "eth_chainId") return "0xf22f";
      throw new Error(`Unexpected method: ${method}`);
    },
  };

  await getStudionetProvider({
    chainId: "eip155:1",
    walletClientType: "metamask",
    switchChain: async () => {
      switchFinished = true;
    },
    getEthereumProvider: async () => {
      assert.equal(switchFinished, true);
      return provider as never;
    },
  });
}

async function testProviderRefreshFailureNamesTheStage(): Promise<void> {
  await assert.rejects(
    getStudionetProvider({
      chainId: "eip155:1",
      walletClientType: "metamask",
      switchChain: async () => undefined,
      getEthereumProvider: async () => {
        throw new Error("execution failed");
      },
    }),
    /metamask could not refresh its provider after switching networks \(refresh\): execution failed/i,
  );
}

async function testUserRejectionDoesNotAddAChain(): Promise<void> {
  let addAttempted = false;
  const provider = {
    async request({method}: RpcRequest): Promise<unknown> {
      if (method === "eth_chainId") return "0x1";
      if (method === "wallet_addEthereumChain") addAttempted = true;
      return null;
    },
  };
  const rejection = Object.assign(new Error("User rejected the request"), {code: 4001});

  await assert.rejects(
    getStudionetProvider({
      switchChain: async () => {
        throw rejection;
      },
      getEthereumProvider: async () => provider as never,
    }),
    /network request was rejected/i,
  );
  assert.equal(addAttempted, false);
}

await testGenericSwitchFailureAddsStudionet();
await testUserRejectionDoesNotAddAChain();
await testSwitchRunsBeforeProviderCreation();
await testProviderRefreshFailureNamesTheStage();
console.log("wallet network fallback tests passed");
