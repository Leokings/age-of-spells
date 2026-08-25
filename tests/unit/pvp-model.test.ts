import assert from "node:assert/strict";

import {
  parseLeaderboard,
  parseLobby,
  parseMatchState,
  parsePlayerProfile,
} from "../../src/pvp-model";

const player = "0x0000000000000000000000000000000000000001";
const opponent = "0x0000000000000000000000000000000000000002";
const zero = "0x0000000000000000000000000000000000000000";

const forgedSpell = {
  id: "spell-aos-7-1",
  name: "Volcanic Razorstorm",
  fusion: "Volcanic Storm",
  element: "storm",
  tier: "grand",
  primary_effect: "piercing",
  secondary_effect: "shield",
  description: "Stone-laced winds cut through protection while circling their caster as a hardened gale.",
  incantation: "Raise a stone-edged volcanic wind that cuts through shields and guards me.",
  ingredients: ["fire", "air", "earth"],
  effects: [
    {type: "piercing", target: "enemy", value: 20, health_damage: 20},
    {type: "shield", target: "self", value: 12, applied: 12},
  ],
  caster: player,
  turn: 4,
};

const validMatch = {
  exists: true,
  match_id: "aos-7",
  creator: player,
  invited_player: zero,
  status: "active",
  result: "",
  revision: 5,
  turn: 4,
  player,
  opponent,
  active_player: player,
  is_your_turn: true,
  your_health: 88,
  your_shield: 12,
  opponent_health: 44,
  opponent_shield: 6,
  your_gold: 4,
  hand: ["fire", "water", "air", "earth"],
  opponent_hand_count: 6,
  last_your_spell: forgedSpell,
  last_opponent_spell: {},
  spell_history: [forgedSpell],
  winner: "",
  last_event: "Player 1 forged Volcanic Razorstorm.",
  log: ["Player 1 forged Volcanic Razorstorm."],
};

function cloneMatch(): typeof validMatch {
  return structuredClone(validMatch);
}

function run() {
  assert.equal(parseMatchState({exists: false, player}), null);

  const parsed = parseMatchState(validMatch);
  assert.equal(parsed?.matchId, "aos-7");
  assert.equal(parsed?.isYourTurn, true);
  assert.equal(parsed?.yourShield, 12);
  assert.equal(parsed?.opponentHandCount, 6);
  assert.deepEqual(parsed?.hand, ["fire", "water", "air", "earth"]);
  assert.equal(parsed?.lastYourSpell?.name, "Volcanic Razorstorm");
  assert.equal(parsed?.lastYourSpell?.tier, "grand");
  assert.equal(parsed?.lastYourSpell?.primaryEffect, "piercing");
  assert.equal(parsed?.lastYourSpell?.effects[1]?.applied, 12);
  assert.equal(parsed?.lastOpponentSpell, null);
  assert.equal(parsed?.spellHistory.length, 1);

  assert.throws(
    () => parseMatchState({...validMatch, your_health: 101}),
    /invalid your_health/,
  );
  assert.throws(
    () => parseMatchState({...validMatch, hand: ["unknown-ingredient"]}),
    /invalid hand/,
  );

  const unbounded = cloneMatch();
  unbounded.spell_history[0].effects[0].value = 99;
  unbounded.last_your_spell = unbounded.spell_history[0];
  assert.throws(() => parseMatchState(unbounded), /unbounded spell effect/);

  const illegalAffinity = cloneMatch();
  const illegalSpell = {
    ...illegalAffinity.spell_history[0],
    tier: "dual",
    ingredients: ["fire", "air"],
    primary_effect: "heal",
    secondary_effect: "none",
    effects: [{type: "heal", target: "self", value: 20, applied: 20}],
  };
  illegalAffinity.spell_history = [illegalSpell];
  illegalAffinity.last_your_spell = illegalSpell;
  assert.throws(() => parseMatchState(illegalAffinity), /invalid spell affinities/);

  assert.throws(
    () => parseMatchState({...validMatch, spell_history: []}),
    /inconsistent spell history/,
  );
  assert.throws(
    () => parseMatchState({...validMatch, is_your_turn: false}),
    /inconsistent active player/,
  );
  assert.throws(
    () => parseMatchState({...validMatch, status: "complete", result: "won", active_player: "", winner: ""}),
    /inconsistent completed match/,
  );

  assert.deepEqual(parseLobby({matches: [{
    match_id: "aos-8",
    creator: opponent,
    invited_player: zero,
    visibility: "open",
    revision: 1,
  }]}), [{
    matchId: "aos-8",
    creator: opponent,
    invitedPlayer: zero,
    visibility: "open",
    revision: 1,
  }]);
  assert.throws(
    () => parseLobby({matches: [{
      match_id: "aos-8",
      creator: opponent,
      invited_player: zero,
      visibility: "hidden",
      revision: 1,
    }]}),
    /invalid match visibility/,
  );

  const profile = parsePlayerProfile({
    player,
    xp: 20n,
    wins: "2",
    losses: 1,
    streak: 2,
    best_streak: 3,
  });
  assert.deepEqual(profile, {
    player,
    xp: 20,
    wins: 2,
    losses: 1,
    streak: 2,
    bestStreak: 3,
  });
  assert.deepEqual(parseLeaderboard({entries: [{
    player,
    xp: 20,
    wins: 2,
    losses: 1,
    streak: 2,
    best_streak: 3,
  }]}), [profile]);

  assert.equal(parsePlayerProfile({
    player,
    sp: 30,
    wins: 3,
    losses: 1,
    streak: 1,
    best_streak: 3,
  }).xp, 30, "legacy v2 SP is read as XP");

console.log("Intelligent transmutation PvP parser tests passed");
}

run();
