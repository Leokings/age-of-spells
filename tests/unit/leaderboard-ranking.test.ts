import assert from "node:assert/strict";

import {
  discoverFinalizedPlayers,
  parseLeaderboardPayload,
  rankLeaderboard,
} from "../../src/leaderboard-ranking";

const contract = "0x00000000000000000000000000000000000000aa";
const alice = "0x0000000000000000000000000000000000000001";
const bob = "0x0000000000000000000000000000000000000002";
const charlie = "0x0000000000000000000000000000000000000003";

function successfulTransaction(from: string) {
  return {
    type: 2,
    status: "FINALIZED",
    from_address: from,
    to_address: contract,
    consensus_data: {
      leader_receipt: [{execution_result: "SUCCESS"}],
    },
  };
}

const players = discoverFinalizedPlayers([
  successfulTransaction(alice),
  successfulTransaction(alice.toUpperCase().replace("0X", "0x")),
  successfulTransaction(bob),
  {...successfulTransaction(charlie), status: "PENDING"},
  {...successfulTransaction(charlie), type: 1},
  {
    ...successfulTransaction(charlie),
    consensus_data: {leader_receipt: [{execution_result: "ERROR"}]},
  },
  {...successfulTransaction(charlie), to_address: alice},
], contract);

assert.deepEqual(players, [alice, bob]);

const profiles = [
  {player: alice, xp: 20, wins: 2, losses: 1, streak: 1, bestStreak: 2},
  {player: bob, xp: 30, wins: 3, losses: 0, streak: 3, bestStreak: 3},
  {player: charlie, xp: 20, wins: 2, losses: 4, streak: 2, bestStreak: 4},
  {player: alice.toUpperCase().replace("0X", "0x"), xp: 10, wins: 1, losses: 0, streak: 1, bestStreak: 1},
  {player: "0x0000000000000000000000000000000000000004", xp: 0, wins: 0, losses: 1, streak: 0, bestStreak: 0},
];

assert.deepEqual(rankLeaderboard(profiles).map(({player}) => player), [bob, charlie, alice]);
assert.deepEqual(parseLeaderboardPayload({entries: profiles}).map(({player}) => player), [bob, charlie, alice]);
assert.throws(() => parseLeaderboardPayload({entries: [{player: "bad"}]}), /invalid entry/);
assert.throws(() => discoverFinalizedPlayers({}, contract), /invalid transaction index/);

console.log("finalized leaderboard projection tests passed");
