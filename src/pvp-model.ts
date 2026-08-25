import {
  ELEMENT_GLYPHS,
  INGREDIENT_BY_ID,
  type ElementKind,
  type IngredientAffinity,
} from "./cards";

export const MATCH_MAX_HEALTH = 100;
export const MATCH_MAX_SHIELD = 50;
export const MATCH_MAX_HAND = 12;
export const STANDARD_PACK_COST = 2;
export const ARCANE_PACK_COST = 4;
export const STANDARD_PACK_SIZE = 2;
export const ARCANE_PACK_SIZE = 3;
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type MatchStatus = "waiting" | "active" | "complete" | "cancelled";
export type MatchResult = "" | "won" | "lost" | "cancelled";
export type PackTier = "standard" | "arcane";
export type SpellTier = "dual" | "grand";
export type PrimarySpellEffect =
  | "damage"
  | "piercing"
  | "heal"
  | "shield"
  | "fortify"
  | "drain"
  | "equalize";
export type SecondarySpellEffect = "none" | "damage" | "piercing" | "heal" | "shield";
export type ResolvedEffectType = Exclude<SecondarySpellEffect, "none"> | "equalize";

export type ResolvedSpellEffect = {
  type: ResolvedEffectType;
  target: "enemy" | "self" | "all";
  value: number;
  applied?: number;
  shieldAbsorbed?: number;
  healthDamage?: number;
};

export type ForgedSpell = {
  id: string;
  name: string;
  fusion: string;
  element: ElementKind;
  glyph: string;
  tier: SpellTier;
  primaryEffect: PrimarySpellEffect;
  secondaryEffect: SecondarySpellEffect;
  description: string;
  incantation: string;
  ingredients: string[];
  effects: ResolvedSpellEffect[];
  caster: string;
  turn: number;
};

export type MatchState = {
  matchId: string;
  creator: string;
  invitedPlayer: string;
  status: MatchStatus;
  result: MatchResult;
  revision: number;
  turn: number;
  player: string;
  opponent: string;
  activePlayer: string;
  isYourTurn: boolean;
  yourHealth: number;
  yourShield: number;
  opponentHealth: number;
  opponentShield: number;
  yourGold: number;
  hand: string[];
  opponentHandCount: number;
  lastYourSpell: ForgedSpell | null;
  lastOpponentSpell: ForgedSpell | null;
  spellHistory: ForgedSpell[];
  winner: string;
  lastEvent: string;
  log: string[];
};

export type LobbyEntry = {
  matchId: string;
  creator: string;
  invitedPlayer: string;
  visibility: "open" | "private";
  revision: number;
};

export type PlayerProfile = {
  player: string;
  xp: number;
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
};

export type LeaderboardEntry = PlayerProfile;

export type PvpAdapter = {
  getMatch(): Promise<MatchState | null>;
  getLobby(): Promise<LobbyEntry[]>;
  getProfile(): Promise<PlayerProfile>;
  getLeaderboard(): Promise<LeaderboardEntry[]>;
  createMatch(invitedPlayer: string): Promise<MatchState>;
  joinMatch(matchId: string): Promise<MatchState>;
  cancelMatch(): Promise<MatchState>;
  forgeAndCast(ingredients: string[], incantation: string): Promise<MatchState>;
  buyPack(tier: PackTier): Promise<MatchState>;
  focusTurn(): Promise<MatchState>;
  concedeMatch(): Promise<MatchState>;
};

const MATCH_STATUSES = new Set<MatchStatus>(["waiting", "active", "complete", "cancelled"]);
const MATCH_RESULTS = new Set<MatchResult>(["", "won", "lost", "cancelled"]);
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const MATCH_ID_PATTERN = /^aos-[1-9][0-9]*$/;
const ELEMENTS = new Set<ElementKind>(Object.keys(ELEMENT_GLYPHS) as ElementKind[]);
const PRIMARY_EFFECTS = new Set<PrimarySpellEffect>([
  "damage",
  "piercing",
  "heal",
  "shield",
  "fortify",
  "drain",
  "equalize",
]);
const SECONDARY_EFFECTS = new Set<SecondarySpellEffect>([
  "none",
  "damage",
  "piercing",
  "heal",
  "shield",
]);

const PRIMARY_TEMPLATES: Readonly<
  Record<SpellTier, Partial<Record<PrimarySpellEffect, Record<string, number>>>>
> = {
  dual: {
    damage: {damage: 20},
    piercing: {piercing: 14},
    heal: {heal: 20},
    shield: {shield: 24},
    fortify: {damage: 10, shield: 12},
    drain: {damage: 12, heal: 7},
  },
  grand: {
    damage: {damage: 28},
    piercing: {piercing: 20},
    heal: {heal: 28},
    shield: {shield: 34},
    fortify: {damage: 16, shield: 18},
    drain: {damage: 18, heal: 10},
    equalize: {equalize: 10},
  },
};

const SECONDARY_VALUES: Readonly<Record<Exclude<SecondarySpellEffect, "none">, number>> = {
  damage: 10,
  piercing: 7,
  heal: 10,
  shield: 12,
};

function objectRecord(value: unknown, message: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}

function numberField(record: Record<string, unknown>, key: string): number {
  const parsed = Number(record[key]);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Contract returned invalid ${key}`);
  }
  return parsed;
}

function boundedNumberField(
  record: Record<string, unknown>,
  key: string,
  maximum: number,
): number {
  const parsed = numberField(record, key);
  if (parsed > maximum) throw new Error(`Contract returned invalid ${key}`);
  return parsed;
}

function boundedTextField(
  record: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
): string {
  const value = record[key];
  if (
    typeof value !== "string"
    || value.length < minimum
    || value.length > maximum
    || value !== value.trim()
    || /[\r\n\t]|\s{2,}/.test(value)
  ) {
    throw new Error(`Contract returned invalid ${key}`);
  }
  return value;
}

function addressField(record: Record<string, unknown>, key: string, allowEmpty = false): string {
  const value = String(record[key] ?? "");
  if ((!allowEmpty || value) && !ADDRESS_PATTERN.test(value)) {
    throw new Error(`Contract returned invalid ${key}`);
  }
  return value;
}

function matchIdField(record: Record<string, unknown>): string {
  const value = String(record.match_id ?? "");
  if (!MATCH_ID_PATTERN.test(value)) throw new Error("Contract returned invalid match_id");
  return value;
}

function stringArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Contract returned invalid ${key}`);
  }
  return [...value];
}

function ingredientArray(value: unknown, key: string, minimum = 0, maximum = MATCH_MAX_HAND): string[] {
  const ingredients = stringArray(value, key);
  if (
    ingredients.length < minimum
    || ingredients.length > maximum
    || ingredients.some((ingredient) => !INGREDIENT_BY_ID.has(ingredient))
  ) {
    throw new Error(`Contract returned invalid ${key}`);
  }
  return ingredients;
}

function availableAffinities(ingredients: string[]): Set<IngredientAffinity> {
  const affinities = new Set<IngredientAffinity>();
  for (const id of ingredients) {
    for (const affinity of INGREDIENT_BY_ID.get(id)!.affinities) affinities.add(affinity);
  }
  return affinities;
}

function allowedPrimaryEffects(ingredients: string[]): Set<PrimarySpellEffect> {
  const affinities = availableAffinities(ingredients);
  const allowed = new Set<PrimarySpellEffect>();
  for (const effect of ["damage", "piercing", "heal", "shield"] as const) {
    if (affinities.has(effect)) allowed.add(effect);
  }
  if (affinities.has("damage") && affinities.has("shield")) allowed.add("fortify");
  if (affinities.has("drain") || (affinities.has("damage") && affinities.has("heal"))) {
    allowed.add("drain");
  }
  if (ingredients.length === 3 && ingredients.includes("one-man-stand")) {
    allowed.add("equalize");
  }
  return allowed;
}

function allowedSecondaryEffects(
  ingredients: string[],
  primary: PrimarySpellEffect,
): Set<SecondarySpellEffect> {
  const result = new Set<SecondarySpellEffect>(["none"]);
  if (ingredients.length !== 3 || primary === "fortify" || primary === "drain" || primary === "equalize") {
    return result;
  }
  const supported = allowedPrimaryEffects(ingredients);
  const compatible: Partial<Record<PrimarySpellEffect, SecondarySpellEffect[]>> = {
    damage: ["heal", "shield"],
    piercing: ["heal", "shield"],
    heal: ["damage", "piercing", "shield"],
    shield: ["damage", "piercing", "heal"],
  };
  for (const effect of compatible[primary] ?? []) {
    if (effect !== "none" && supported.has(effect as PrimarySpellEffect)) result.add(effect);
  }
  return result;
}

function expectedEffects(
  tier: SpellTier,
  primary: PrimarySpellEffect,
  secondary: SecondarySpellEffect,
): Array<{type: ResolvedEffectType; target: "enemy" | "self" | "all"; value: number}> {
  const template = PRIMARY_TEMPLATES[tier][primary];
  if (!template) throw new Error("Contract returned an invalid spell template");
  const effects: Array<{type: ResolvedEffectType; target: "enemy" | "self" | "all"; value: number}> = [];
  for (const type of ["damage", "piercing", "heal", "shield", "equalize"] as const) {
    const value = template[type];
    if (value === undefined) continue;
    effects.push({
      type,
      target: type === "equalize" ? "all" : type === "heal" || type === "shield" ? "self" : "enemy",
      value,
    });
  }
  if (secondary !== "none") {
    effects.push({
      type: secondary,
      target: secondary === "heal" || secondary === "shield" ? "self" : "enemy",
      value: SECONDARY_VALUES[secondary],
    });
  }
  return effects;
}

function parseResolvedEffect(
  value: unknown,
  expected: {type: ResolvedEffectType; target: "enemy" | "self" | "all"; value: number},
): ResolvedSpellEffect {
  const record = objectRecord(value, "Contract returned an invalid resolved effect");
  if (record.type !== expected.type || record.target !== expected.target) {
    throw new Error("Contract returned an invalid resolved effect");
  }
  const amount = numberField(record, "value");
  if (amount !== expected.value) throw new Error("Contract returned an unbounded spell effect");

  const result: ResolvedSpellEffect = {type: expected.type, target: expected.target, value: amount};
  if (expected.type === "damage") {
    const shieldAbsorbed = boundedNumberField(record, "shield_absorbed", amount);
    const healthDamage = boundedNumberField(record, "health_damage", amount);
    if (shieldAbsorbed + healthDamage !== amount) {
      throw new Error("Contract returned an invalid damage breakdown");
    }
    result.shieldAbsorbed = shieldAbsorbed;
    result.healthDamage = healthDamage;
  } else if (expected.type === "piercing") {
    result.healthDamage = boundedNumberField(record, "health_damage", amount);
  } else if (expected.type === "heal" || expected.type === "shield") {
    result.applied = boundedNumberField(record, "applied", amount);
  }
  return result;
}

function parseForgedSpell(value: unknown, matchId: string): ForgedSpell | null {
  const record = objectRecord(value, "Contract returned an invalid forged spell");
  if (Object.keys(record).length === 0) return null;

  const id = String(record.id ?? "");
  if (!new RegExp(`^spell-${matchId}-[1-9][0-9]*$`).test(id)) {
    throw new Error("Contract returned invalid spell id");
  }
  const ingredients = ingredientArray(record.ingredients, "ingredients", 2, 3);
  const tier = String(record.tier ?? "") as SpellTier;
  if ((tier !== "dual" && tier !== "grand") || (tier === "dual") !== (ingredients.length === 2)) {
    throw new Error("Contract returned invalid spell tier");
  }
  if (ingredients.includes("one-man-stand") && ingredients.length !== 3) {
    throw new Error("Contract returned invalid mythic fusion");
  }

  const primaryEffect = String(record.primary_effect ?? "") as PrimarySpellEffect;
  const secondaryEffect = String(record.secondary_effect ?? "") as SecondarySpellEffect;
  if (
    !PRIMARY_EFFECTS.has(primaryEffect)
    || !SECONDARY_EFFECTS.has(secondaryEffect)
    || !allowedPrimaryEffects(ingredients).has(primaryEffect)
    || !allowedSecondaryEffects(ingredients, primaryEffect).has(secondaryEffect)
  ) {
    throw new Error("Contract returned invalid spell affinities");
  }

  const rawEffects = record.effects;
  const expected = expectedEffects(tier, primaryEffect, secondaryEffect);
  if (!Array.isArray(rawEffects) || rawEffects.length !== expected.length) {
    throw new Error("Contract returned invalid spell effects");
  }
  const effects = rawEffects.map((effect, index) => parseResolvedEffect(effect, expected[index]));
  const element = String(record.element ?? "") as ElementKind;
  if (!ELEMENTS.has(element)) throw new Error("Contract returned invalid spell element");

  return {
    id,
    name: boundedTextField(record, "name", 3, 32),
    fusion: boundedTextField(record, "fusion", 3, 32),
    element,
    glyph: ELEMENT_GLYPHS[element],
    tier,
    primaryEffect,
    secondaryEffect,
    description: boundedTextField(record, "description", 12, 140),
    incantation: boundedTextField(record, "incantation", 12, 240),
    ingredients,
    effects,
    caster: addressField(record, "caster"),
    turn: numberField(record, "turn"),
  };
}

export function parseMatchState(value: unknown): MatchState | null {
  const record = objectRecord(value, "Contract returned an invalid match");
  if (record.exists === false) return null;

  const matchId = matchIdField(record);
  const status = String(record.status ?? "") as MatchStatus;
  const result = String(record.result ?? "") as MatchResult;
  const player = addressField(record, "player");
  const opponent = addressField(record, "opponent", true);
  const activePlayer = addressField(record, "active_player", true);
  const winner = addressField(record, "winner", true);
  if (!MATCH_STATUSES.has(status)) throw new Error("Contract returned invalid match status");
  if (!MATCH_RESULTS.has(result)) throw new Error("Contract returned invalid match result");
  if (status === "active") {
    if (!opponent || opponent.toLowerCase() === ZERO_ADDRESS || !activePlayer) {
      throw new Error("Contract returned an inconsistent active match");
    }
    const expectedTurn = activePlayer.toLowerCase() === player.toLowerCase();
    if (Boolean(record.is_your_turn) !== expectedTurn) {
      throw new Error("Contract returned an inconsistent active player");
    }
  } else if (activePlayer) {
    throw new Error("Contract returned an inconsistent inactive match");
  }
  if (status === "complete" && (!winner || (result !== "won" && result !== "lost"))) {
    throw new Error("Contract returned an inconsistent completed match");
  }
  if (status === "cancelled" && result !== "cancelled") {
    throw new Error("Contract returned an inconsistent cancelled match");
  }

  const spellHistoryRaw = record.spell_history;
  if (!Array.isArray(spellHistoryRaw) || spellHistoryRaw.length > 10) {
    throw new Error("Contract returned invalid spell_history");
  }
  const spellHistory = spellHistoryRaw.map((spell) => {
    const parsed = parseForgedSpell(spell, matchId);
    if (!parsed) throw new Error("Contract returned empty spell history entry");
    return parsed;
  });
  const lastYourSpell = parseForgedSpell(record.last_your_spell, matchId);
  const lastOpponentSpell = parseForgedSpell(record.last_opponent_spell, matchId);
  const historyIds = new Set(spellHistory.map((spell) => spell.id));
  if (
    (lastYourSpell && !historyIds.has(lastYourSpell.id))
    || (lastOpponentSpell && !historyIds.has(lastOpponentSpell.id))
  ) {
    throw new Error("Contract returned inconsistent spell history");
  }

  const log = stringArray(record.log, "log");
  if (log.length > 10) throw new Error("Contract returned invalid log");
  return {
    matchId,
    creator: addressField(record, "creator"),
    invitedPlayer: addressField(record, "invited_player"),
    status,
    result,
    revision: numberField(record, "revision"),
    turn: numberField(record, "turn"),
    player,
    opponent,
    activePlayer,
    isYourTurn: Boolean(record.is_your_turn),
    yourHealth: boundedNumberField(record, "your_health", MATCH_MAX_HEALTH),
    yourShield: boundedNumberField(record, "your_shield", MATCH_MAX_SHIELD),
    opponentHealth: boundedNumberField(record, "opponent_health", MATCH_MAX_HEALTH),
    opponentShield: boundedNumberField(record, "opponent_shield", MATCH_MAX_SHIELD),
    yourGold: numberField(record, "your_gold"),
    hand: ingredientArray(record.hand, "hand"),
    opponentHandCount: boundedNumberField(record, "opponent_hand_count", MATCH_MAX_HAND),
    lastYourSpell,
    lastOpponentSpell,
    spellHistory,
    winner,
    lastEvent: String(record.last_event ?? ""),
    log,
  };
}

export function parseLobby(value: unknown): LobbyEntry[] {
  const record = objectRecord(value, "Contract returned an invalid lobby");
  const entries = record.matches;
  if (!Array.isArray(entries) || entries.length > 20) {
    throw new Error("Contract returned invalid lobby matches");
  }
  return entries.map((entry) => {
    const item = objectRecord(entry, "Contract returned an invalid lobby match");
    const visibility = String(item.visibility ?? "");
    if (visibility !== "open" && visibility !== "private") {
      throw new Error("Contract returned invalid match visibility");
    }
    return {
      matchId: matchIdField(item),
      creator: addressField(item, "creator"),
      invitedPlayer: addressField(item, "invited_player"),
      visibility,
      revision: numberField(item, "revision"),
    };
  });
}

export function parsePlayerProfile(value: unknown): PlayerProfile {
  const record = objectRecord(value, "Contract returned an invalid profile");
  // The finalized v2 Studionet contract returns `sp`. New deployments return
  // `xp`; accepting both lets the UI adopt the product terminology without
  // breaking reads from matches settled before the XP migration.
  const xpRecord = record.xp === undefined
    ? {...record, xp: record.sp}
    : record;
  return {
    player: addressField(record, "player"),
    xp: numberField(xpRecord, "xp"),
    wins: numberField(record, "wins"),
    losses: numberField(record, "losses"),
    streak: numberField(record, "streak"),
    bestStreak: numberField(record, "best_streak"),
  };
}

export function parseLeaderboard(value: unknown): LeaderboardEntry[] {
  const record = objectRecord(value, "Contract returned an invalid leaderboard");
  const entries = record.entries;
  if (!Array.isArray(entries) || entries.length > 100) {
    throw new Error("Contract returned invalid leaderboard entries");
  }
  return entries.map(parsePlayerProfile);
}
