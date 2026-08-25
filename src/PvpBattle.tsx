import {useEffect, useMemo, useRef, useState, type CSSProperties} from "react";
import {usePrivy, useWallets} from "@privy-io/react-auth";

import type {AppPath} from "./app-route";
import {ADDRESS_PATTERN} from "./contract-config";
import {
  ELEMENT_GLYPHS,
  INGREDIENT_BY_ID,
  type ElementKind,
  type IngredientDefinition,
} from "./cards";
import HorizontalCardRail from "./components/HorizontalCardRail";
import SiteHeader from "./components/SiteHeader";
import SpellCard from "./components/SpellCard";
import {
  ARCANE_PACK_COST,
  ARCANE_PACK_SIZE,
  MATCH_MAX_HAND,
  MATCH_MAX_HEALTH,
  MATCH_MAX_SHIELD,
  STANDARD_PACK_COST,
  STANDARD_PACK_SIZE,
  ZERO_ADDRESS,
  type ForgedSpell,
  type LeaderboardEntry,
  type LobbyEntry,
  type MatchState,
  type PackTier,
  type PlayerProfile,
  type PvpAdapter,
  type ResolvedSpellEffect,
} from "./pvp-model";
import type {ConnectedWallet} from "./wallet-network";
import {
  HAS_PVP_DEPLOYMENT,
  AGE_OF_SPELLS_PVP_CONTRACT_ADDRESS,
  SubmittedPvpTransactionError,
  createStudionetPvpAdapter,
} from "./genlayer-pvp";
import {loadGlobalLeaderboard} from "./leaderboard-projection";
import {STUDIONET_EXPLORER_URL} from "./studionet";
import "./battle.css";
import "./pvp.css";

type VisualEffect = {
  id: number;
  element: ElementKind;
  glyph: string;
  text: string;
};

export type GameView = "matches" | "arena" | "leaderboard";

type PvpBattleProps = {
  view: GameView;
  onNavigate: (path: AppPath) => void;
};

const EMPTY_PROFILE: PlayerProfile = {
  player: "",
  xp: 0,
  wins: 0,
  losses: 0,
  streak: 0,
  bestStreak: 0,
};

function shorten(value: string): string {
  return value.length > 14 ? `${value.slice(0, 7)}…${value.slice(-5)}` : value;
}

function friendlyError(cause: unknown): string {
  if (cause instanceof SubmittedPvpTransactionError) return cause.message;
  const raw = cause instanceof Error ? cause.message : String(cause);
  const messages: Record<string, string> = {
    active_match_exists: "Finish or cancel your current match before entering another.",
    cannot_challenge_self: "Choose another wallet for a private challenge.",
    lobby_is_full: "The lobby is full right now. Join an existing challenge.",
    match_not_found: "That match no longer exists.",
    match_not_waiting: "Another player already joined or the challenge was cancelled.",
    cannot_join_own_match: "You cannot join your own challenge.",
    match_is_private: "That challenge is reserved for another wallet.",
    only_creator_can_cancel: "Only the wallet that opened this challenge can cancel it.",
    no_active_match: "This wallet does not have an active match.",
    match_not_active: "That match has already ended.",
    not_your_turn: "The other player currently owns the turn.",
    fusion_requires_two_or_three_cards: "A spell must fuse exactly two or three ingredient cards.",
    unknown_ingredient: "One selected ingredient is not part of Age of Spells.",
    ingredient_not_in_hand: "One selected ingredient is no longer in your hand. Refresh and choose again.",
    one_man_stand_requires_three_cards: "One Man Stand can only be used in a three-card Grand Fusion.",
    incantation_too_short: "Write at least 12 characters so the Spell Council can interpret your intent.",
    incantation_too_long: "Keep your incantation at 240 characters or fewer.",
    incantation_unselected_element: "Your incantation requires an element or catalyst you did not select. Your cards were not burned.",
    incantation_unsupported_intent: "Those ingredients cannot support the requested effect. Your cards were not burned.",
    incantation_incoherent: "The Spell Council could not interpret that incantation. Your cards were not burned.",
    not_enough_gold: "You do not have enough match gold for that pack.",
    not_enough_hand_space: "Your hand does not have enough open slots for every card in that pack.",
    hand_is_full: `Your hand is full at ${MATCH_MAX_HAND} cards.`,
    fusion_returned_invalid_json: "The Spell Council returned invalid data. Try the same move again.",
    fusion_validity_invalid: "The Spell Council could not settle the validity of this fusion. Try again.",
    fusion_invalid_reason_unknown: "The Spell Council returned an unsupported ruling. Try again.",
    fusion_fields_must_be_text: "The Spell Council returned malformed spell text. Try again.",
    fusion_name_length_invalid: "The Spell Council could not settle a valid spell name. Try again.",
    fusion_family_length_invalid: "The Spell Council could not settle a valid fusion family. Try again.",
    fusion_description_length_invalid: "The Spell Council could not settle valid spell lore. Try again.",
    fusion_element_invalid: "The Spell Council proposed an unsupported visual element. Try again.",
    fusion_primary_effect_invalid: "The proposed primary effect is not supported by your ingredients.",
    fusion_secondary_effect_invalid: "The proposed secondary effect is not supported by this Grand Fusion.",
  };
  const marked = raw.match(/\[(?:EXPECTED|LLM_ERROR)\]\s*([a-z][a-z0-9_]+)/i)?.[1];
  const key = marked ?? Object.keys(messages).find((candidate) => raw.includes(candidate));
  return key && messages[key] ? messages[key] : raw;
}

function Meter({
  label,
  value,
  max,
  kind,
}: {
  label: string;
  value: number;
  max: number;
  kind: "health" | "shield";
}) {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));
  const style = {"--meter-fill": `${percentage}%`} as CSSProperties;
  return (
    <div className={`aos-meter ${kind}`} style={style}>
      <div className="aos-meter-copy">
        <span>{label}</span>
        <strong>{value}/{max}</strong>
      </div>
      <div
        className="aos-meter-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <i />
      </div>
    </div>
  );
}

function Combatant({
  name,
  title,
  health,
  shield,
  lastSpell,
  badge,
  fallbackElement,
}: {
  name: string;
  title: string;
  health: number;
  shield: number;
  lastSpell: ForgedSpell | null;
  badge: string;
  fallbackElement: ElementKind;
}) {
  const element = lastSpell?.element ?? fallbackElement;
  const knockedOut = health === 0;
  return (
    <article className={`aos-player-panel aos-duel-combatant element-${element} ${knockedOut ? "knocked-out" : ""}`}>
      <div className="aos-player-heading">
        <div className="aos-avatar" aria-hidden="true">{lastSpell?.glyph ?? ELEMENT_GLYPHS[fallbackElement]}</div>
        <div><span>{title}</span><h2>{name}</h2></div>
        <b>{knockedOut ? "OUT" : badge}</b>
      </div>
      <Meter label="Health" value={health} max={MATCH_MAX_HEALTH} kind="health" />
      <Meter label="Shield" value={shield} max={MATCH_MAX_SHIELD} kind="shield" />
      <div className="aos-last-spell">
        <span>Last fusion</span>
        <strong>{lastSpell?.name ?? "None"}</strong>
      </div>
    </article>
  );
}

function EffectLayer({effect}: {effect: VisualEffect | null}) {
  if (!effect) return null;
  return (
    <div className={`aos-effect element-${effect.element}`} key={effect.id} aria-live="polite">
      <div className="aos-effect-ring" />
      <div className="aos-effect-particles" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
      <strong>{effect.glyph}</strong>
      <span>{effect.text}</span>
    </div>
  );
}

function effectLabel(effect: ResolvedSpellEffect): string {
  if (effect.type === "damage") {
    return `${effect.value} damage (${effect.shieldAbsorbed ?? 0} shield, ${effect.healthDamage ?? 0} health)`;
  }
  if (effect.type === "piercing") return `${effect.healthDamage ?? effect.value} piercing damage`;
  if (effect.type === "heal") return `${effect.applied ?? 0} health restored`;
  if (effect.type === "shield") return `${effect.applied ?? 0} shield gained`;
  return "both mages set to 10 health";
}

function ForgedSpellSummary({spell}: {spell: ForgedSpell}) {
  return (
    <article className={`aos-forged-summary element-${spell.element}`}>
      <div className="aos-forged-glyph" aria-hidden="true">{spell.glyph}</div>
      <div>
        <span>{spell.tier} fusion · {spell.fusion}</span>
        <strong>{spell.name}</strong>
        <p>{spell.description}</p>
        <small>{spell.ingredients.join(" + ")} · {spell.effects.map(effectLabel).join(" · ")}</small>
      </div>
    </article>
  );
}

function resultCopy(match: MatchState): {eyebrow: string; title: string; copy: string} {
  if (match.result === "won") {
    return {
      eyebrow: "MATCH COMPLETE · +10 XP",
      title: "Victory is yours.",
      copy: "The result and your XP are finalized on Studionet. Ranking refreshes from finalized results.",
    };
  }
  if (match.result === "lost") {
    return {
      eyebrow: "MATCH COMPLETE",
      title: "Your rival prevailed.",
      copy: "Choose new ingredient lines and challenge another wallet.",
    };
  }
  return {
    eyebrow: "CHALLENGE CLOSED",
    title: "The challenge was cancelled.",
    copy: "No XP was awarded and you can enter another match immediately.",
  };
}

const TITLE_TIERS = [
  {xp: 0, title: "Apprentice"},
  {xp: 30, title: "Spellweaver"},
  {xp: 80, title: "Arcanist"},
  {xp: 160, title: "High Mage"},
  {xp: 300, title: "Archmage"},
] as const;

function titleForXp(xp: number): string {
  let current: string = TITLE_TIERS[0].title;
  for (const tier of TITLE_TIERS) {
    if (xp < tier.xp) break;
    current = tier.title;
  }
  return current;
}

function ProfileSummary({
  profile,
  entries,
  ranking,
}: {
  profile: PlayerProfile;
  entries: LeaderboardEntry[];
  ranking: boolean;
}) {
  const rankIndex = entries.findIndex((entry) => entry.player.toLowerCase() === profile.player.toLowerCase());
  const nextTier = TITLE_TIERS.find((tier) => tier.xp > profile.xp);
  const previousTier = [...TITLE_TIERS].reverse().find((tier) => tier.xp <= profile.xp) ?? TITLE_TIERS[0];
  const tierSpan = nextTier ? nextTier.xp - previousTier.xp : 1;
  const tierProgress = nextTier ? Math.min(100, ((profile.xp - previousTier.xp) / tierSpan) * 100) : 100;
  const style = {"--title-progress": `${tierProgress}%`} as CSSProperties;

  return (
    <section className="aos-profile-summary" aria-labelledby="profile-summary-heading">
      <div className="aos-profile-seal" aria-hidden="true">
        <img src="/brand/age-of-spells-elemental-mark-v2.webp" alt="" width="96" height="96" />
      </div>
      <div className="aos-profile-identity">
        <p>CONNECTED MAGE</p>
        <h2 id="profile-summary-heading">{profile.player ? shorten(profile.player) : "Wallet not connected"}</h2>
        <span>{titleForXp(profile.xp)}</span>
      </div>
      <dl>
        <div><dt>XP</dt><dd>{profile.xp}</dd></div>
        <div><dt>Wins</dt><dd>{profile.wins}</dd></div>
        <div><dt>Losses</dt><dd>{profile.losses}</dd></div>
        <div><dt>Rank</dt><dd>{ranking ? "Calculating…" : rankIndex >= 0 ? `#${rankIndex + 1}` : profile.player ? "Outside top 100" : "—"}</dd></div>
      </dl>
      <div className="aos-title-progress" style={style}>
        <div><span>Title progression</span><b>{nextTier ? `${nextTier.xp - profile.xp} XP to ${nextTier.title}` : "Highest title reached"}</b></div>
        <i><span /></i>
      </div>
    </section>
  );
}

function ViewHero({eyebrow, title, copy, marker}: {eyebrow: string; title: string; copy: string; marker: string}) {
  return (
    <section className="aos-view-hero">
      <div><p><span />{eyebrow}</p><h1>{title}</h1><small>{copy}</small></div>
      <b aria-hidden="true">{marker}</b>
    </section>
  );
}

function Leaderboard({
  entries,
  player,
  loading,
}: {
  entries: LeaderboardEntry[];
  player: string;
  loading: boolean;
}) {
  return (
    <section className="aos-leaderboard" aria-labelledby="leaderboard-heading">
      <div className="aos-leaderboard-heading">
        <div><p>STUDIONET RANKING</p><h2 id="leaderboard-heading">PvP leaderboard</h2></div>
        <span>Top 100</span>
      </div>
      {loading ? (
        <p className="aos-empty-ranking" role="status">Projecting finalized XP from Studionet…</p>
      ) : entries.length === 0 ? (
        <p className="aos-empty-ranking">No ranked victories yet. The first PvP winner takes the crown.</p>
      ) : (
        <ol>
          {entries.map((entry, index) => (
            <li className={entry.player.toLowerCase() === player.toLowerCase() ? "current" : ""} key={entry.player}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <span>{shorten(entry.player)}</span>
              <small>{entry.wins}W · best {entry.bestStreak}</small>
              <strong>{entry.xp} XP</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Lobby({
  entries,
  player,
  busy,
  onJoin,
}: {
  entries: LobbyEntry[];
  player: string;
  busy: boolean;
  onJoin: (matchId: string) => void;
}) {
  const joinable = entries.filter((entry) => entry.creator.toLowerCase() !== player.toLowerCase());
  return (
    <section className="aos-lobby" aria-labelledby="lobby-heading">
      <div className="aos-lobby-heading">
        <div><p>LIVE MATCHMAKING</p><h2 id="lobby-heading">Open challenges</h2></div>
        <span>{joinable.length} available</span>
      </div>
      {joinable.length === 0 ? (
        <p className="aos-empty-lobby">No joinable challenge is open. Create one and share its match ID.</p>
      ) : (
        <div className="aos-lobby-grid">
          {joinable.map((entry) => (
            <article key={entry.matchId}>
              <span>{entry.visibility === "private" ? "PRIVATE INVITE" : "OPEN MATCH"}</span>
              <strong>{entry.matchId}</strong>
              <small>Created by {shorten(entry.creator)}</small>
              <button type="button" onClick={() => onJoin(entry.matchId)} disabled={busy}>Join match</button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default function PvpBattle({view, onNavigate}: PvpBattleProps) {
  const {ready, authenticated, login, logout, user} = usePrivy();
  const {wallets, ready: walletsReady} = useWallets();
  const loginWalletAddress = user?.wallet?.address?.toLowerCase();
  const wallet = useMemo(
    () =>
      wallets.find((candidate) => candidate.address.toLowerCase() === loginWalletAddress)
      ?? wallets.find((candidate) => candidate.linked)
      ?? wallets[0],
    [loginWalletAddress, wallets],
  );
  const connectedWallet = wallet as ConnectedWallet | undefined;
  const connected = ready && walletsReady && authenticated && Boolean(connectedWallet);
  const [transactionHash, setTransactionHash] = useState<`0x${string}` | null>(null);
  const adapter = useMemo<PvpAdapter | null>(() => {
    if (!connected || !connectedWallet || !HAS_PVP_DEPLOYMENT) return null;
    return createStudionetPvpAdapter(connectedWallet, {
      onSubmitted: (hash) => setTransactionHash(hash),
    });
  }, [connected, connectedWallet]);

  const [match, setMatch] = useState<MatchState | null>(null);
  const [lobby, setLobby] = useState<LobbyEntry[]>([]);
  const [profile, setProfile] = useState<PlayerProfile>(EMPTY_PROFILE);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [inviteAddress, setInviteAddress] = useState("");
  const [selectedIngredients, setSelectedIngredients] = useState<number[]>([]);
  const [incantation, setIncantation] = useState("");
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [effect, setEffect] = useState<VisualEffect | null>(null);
  const effectId = useRef(0);

  useEffect(() => {
    if (!effect) return;
    const timeout = window.setTimeout(() => setEffect(null), 1_250);
    return () => window.clearTimeout(timeout);
  }, [effect]);

  useEffect(() => {
    let cancelled = false;
    setSelectedIngredients([]);
    setIncantation("");
    setError(null);
    if (!adapter) {
      setMatch(null);
      setLobby([]);
      setProfile(EMPTY_PROFILE);
      setBusyLabel(null);
      return () => { cancelled = true; };
    }

    setBusyLabel("Reading finalized PvP state…");
    // These reads are intentionally sequential. Studionet is rate-limited and
    // a burst here used to make one optional view hide all usable game state.
    void (async () => {
      try {
        const nextMatch = await adapter.getMatch();
        if (cancelled) return;
        setMatch(nextMatch);

        const nextProfile = await adapter.getProfile();
        if (cancelled) return;
        setProfile(nextProfile);

        if (view === "matches") {
          const nextLobby = await adapter.getLobby();
          if (!cancelled) setLobby(nextLobby);
        }
      } catch (cause) {
        if (!cancelled) setError(friendlyError(cause));
      } finally {
        if (!cancelled) setBusyLabel(null);
      }
    })();
    return () => { cancelled = true; };
  }, [adapter, view]);

  useEffect(() => {
    if (view !== "leaderboard") return;
    let cancelled = false;
    setLeaderboardLoading(true);
    void loadGlobalLeaderboard(AGE_OF_SPELLS_PVP_CONTRACT_ADDRESS)
      .then((entries) => {
        if (!cancelled) setLeaderboard(entries);
      })
      .catch((cause) => {
        if (!cancelled) setError(friendlyError(cause));
      })
      .finally(() => {
        if (!cancelled) setLeaderboardLoading(false);
      });
    return () => { cancelled = true; };
  }, [view]);

  useEffect(() => {
    if (!adapter || busyLabel || view === "leaderboard") return;
    const shouldPollMatch = match?.status === "waiting" || (match?.status === "active" && !match.isYourTurn);
    const shouldPollLobby = view === "matches" && (!match || match.status === "complete" || match.status === "cancelled");
    if (!shouldPollMatch && !shouldPollLobby) return;

    let cancelled = false;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          let nextMatch = match;
          if (shouldPollMatch) {
            nextMatch = await adapter.getMatch();
            if (!cancelled) setMatch(nextMatch);
          }
          if (shouldPollLobby) {
            const nextLobby = await adapter.getLobby();
            if (!cancelled) setLobby(nextLobby);
          }
          if (nextMatch?.status === "complete") {
            const nextProfile = await adapter.getProfile();
            if (!cancelled) setProfile(nextProfile);
          }
        } catch {
          // Background polling is best-effort; explicit Refresh reports errors.
        }
      })();
    }, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [adapter, busyLabel, match, view]);

  const normalizedIncantation = incantation.trim().replace(/\s+/g, " ");
  const isActive = match?.status === "active";
  const yourTurn = Boolean(isActive && match?.isYourTurn);
  const playerName = connectedWallet ? shorten(connectedWallet.address) : "Unbound Mage";
  const explorerTransaction = transactionHash ? `${STUDIONET_EXPLORER_URL}/tx/${transactionHash}` : null;
  const selectedCards = selectedIngredients
    .map((index) => match?.hand[index])
    .filter((id): id is string => Boolean(id))
    .map((id) => INGREDIENT_BY_ID.get(id))
    .filter((card): card is IngredientDefinition => Boolean(card));
  const selectedIds = selectedCards.map((card) => card.id);
  const hasOneManStand = selectedIds.includes("one-man-stand");
  const selectionIsValid = selectedIds.length === 2 || selectedIds.length === 3;
  const incantationIsValid = normalizedIncantation.length >= 12 && normalizedIncantation.length <= 240;
  const forgeReady = selectionIsValid && incantationIsValid && (!hasOneManStand || selectedIds.length === 3);
  const latestSpell = match?.spellHistory[(match?.spellHistory.length ?? 0) - 1] ?? null;

  function clearForgeInput() {
    setSelectedIngredients([]);
    setIncantation("");
  }

  function showSpell(spell: ForgedSpell, text: string) {
    effectId.current += 1;
    setEffect({id: effectId.current, element: spell.element, glyph: spell.glyph, text});
  }

  async function refreshAll() {
    if (!adapter) return;
    setBusyLabel("Refreshing finalized match state…");
    setError(null);
    try {
      const nextMatch = await adapter.getMatch();
      setMatch(nextMatch);

      const nextProfile = await adapter.getProfile();
      setProfile(nextProfile);

      if (view === "matches") setLobby(await adapter.getLobby());
      if (view === "leaderboard") {
        setLeaderboardLoading(true);
        setLeaderboard(await adapter.getLeaderboard());
      }
      clearForgeInput();
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusyLabel(null);
      setLeaderboardLoading(false);
    }
  }

  async function runAction(label: string, action: () => Promise<MatchState>) {
    if (!adapter) return null;
    setBusyLabel(label);
    setError(null);
    try {
      const next = await action();
      setMatch(next);
      clearForgeInput();
      if (next.status === "complete") {
        void adapter.getProfile()
          .then(setProfile)
          .catch(() => undefined);
      }
      return next;
    } catch (cause) {
      if (cause instanceof SubmittedPvpTransactionError) {
        setTransactionHash(cause.transactionHash);
      }
      setError(friendlyError(cause));
      return null;
    } finally {
      setBusyLabel(null);
    }
  }

  async function createMatch(invitedPlayer: string) {
    if (!adapter) {
      login();
      return;
    }
    if (!ADDRESS_PATTERN.test(invitedPlayer)) {
      setError("Enter a valid 0x wallet address for a private challenge.");
      return;
    }
    const next = await runAction(
      invitedPlayer === ZERO_ADDRESS ? "Opening a public challenge…" : "Creating a private challenge…",
      () => adapter.createMatch(invitedPlayer),
    );
    if (next) {
      setInviteAddress("");
      onNavigate("/arena");
    }
  }

  async function joinMatch(matchId: string) {
    if (!adapter) return;
    const next = await runAction(`Joining ${matchId}…`, () => adapter.joinMatch(matchId));
    if (next) onNavigate("/arena");
  }

  async function forgeAndCast() {
    if (!adapter || !match || !yourTurn || !forgeReady) return;
    const next = await runAction(
      "The validator council is interpreting your fusion…",
      () => adapter.forgeAndCast(selectedIds, normalizedIncantation),
    );
    if (next?.lastYourSpell) showSpell(next.lastYourSpell, next.lastYourSpell.name);
  }

  async function buyPack(tier: PackTier) {
    if (!adapter || !match || !yourTurn) return;
    await runAction(`Opening a ${tier} ingredient pack…`, () => adapter.buyPack(tier));
  }

  function handleIngredientSelect(index: number) {
    setSelectedIngredients((current) => {
      if (current.includes(index)) return current.filter((value) => value !== index);
      if (current.length >= 3) return current;
      return [...current, index];
    });
  }

  const arenaTitle = !adapter
    ? HAS_PVP_DEPLOYMENT ? "Connect a wallet to enter" : "Studionet deployment pending"
    : match?.status === "waiting"
      ? "Waiting for another mage"
      : match?.status === "complete" || match?.status === "cancelled"
        ? resultCopy(match).title
        : !match
          ? "No active duel"
          : !match.isYourTurn
            ? "Your opponent owns the turn"
            : selectedCards.length < 2
              ? "Choose two or three ingredients"
              : selectedCards.length === 2
                ? "Shape a Dual Fusion"
                : "Shape a Grand Fusion";
  const arenaInstruction = !adapter
    ? "Every match action is signed through Privy and settled gaslessly on Studionet."
    : match?.status === "waiting"
      ? `${match.matchId} is live. This screen checks automatically for a joining wallet.`
      : match?.status === "complete" || match?.status === "cancelled"
        ? resultCopy(match).copy
        : !match
          ? "The Arena is reserved for live combat. Find or create a challenge in the Match Hall."
          : !match.isYourTurn
            ? "The match refreshes automatically when the other wallet makes a move."
            : "Cards cannot be cast alone. Your words shape the spell; ingredient affinities and fixed power limits keep it fair.";

  const activePath: AppPath = view === "matches" ? "/matches" : view === "leaderboard" ? "/leaderboard" : "/arena";
  const hasCurrentMatch = Boolean(match && (match.status === "waiting" || match.status === "active"));
  const walletAction = connected ? (
    <button className="aos-header-wallet connected" type="button" onClick={() => void logout()} disabled={Boolean(busyLabel)}>
      <span />{shorten(connectedWallet!.address)} · Disconnect
    </button>
  ) : (
    <button className="aos-header-wallet" type="button" onClick={login} disabled={!ready || Boolean(busyLabel)}>
      Connect wallet
    </button>
  );

  return (
    <main className={`aos-game-shell aos-product-view view-${view}`}>
      <SiteHeader activePath={activePath} onNavigate={onNavigate} walletAction={walletAction} />

      {view === "matches" ? (
        <ViewHero
          eyebrow="THE MATCH HALL · LIVE STUDIONET"
          title="Find a rival. Forge what follows."
          copy="Open a public challenge, reserve a duel for one wallet, or answer a live summons from another mage."
          marker={String(lobby.filter((entry) => entry.creator.toLowerCase() !== profile.player.toLowerCase()).length).padStart(2, "0")}
        />
      ) : null}

      {view === "leaderboard" ? (
        <ViewHero
          eyebrow="THE ASCENDANT ORDER · GLOBAL PVP"
          title="The top one hundred mages."
          copy="XP is awarded by the intelligent contract when a match settles. Titles are derived from finalized XP."
          marker={leaderboardLoading ? "··" : String(Math.min(100, leaderboard.length)).padStart(2, "0")}
        />
      ) : null}

      {view === "arena" ? (
        <section className="aos-battle-header aos-duel-header">
          <div className="aos-hero-copy">
            <p><span />THE ELEMENTAL ARENA · INTELLIGENT PVP</p>
            <h1>Burn ingredients.<br />Speak <em>spells</em> into being.</h1>
            <div className="aos-hero-rules" role="list" aria-label="Core game rules">
              <span role="listitem"><b>12</b> opening cards</span>
              <span role="listitem"><b>2–3</b> per fusion</span>
              <span role="listitem"><b>100</b> starting health</span>
            </div>
          </div>
          <div className="aos-turn-token">
            <span>{match?.status === "active" ? (match.isYourTurn ? "YOUR TURN" : "RIVAL TURN") : "AWAITING DUEL"}</span>
            <strong>{String(match?.turn ?? 0).padStart(2, "0")}</strong>
            <small>STUDIONET</small>
          </div>
        </section>
      ) : null}

      <div className={`aos-contract-ribbon ${adapter ? "onchain" : ""}`} role="status">
        <i />
        {adapter ? "Live intelligent PvP on Studionet" : "Wallet required"}
        <span>
          {adapter ? (
            <a href={`${STUDIONET_EXPLORER_URL}/address/${AGE_OF_SPELLS_PVP_CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">
              Contract {shorten(AGE_OF_SPELLS_PVP_CONTRACT_ADDRESS)} ↗
            </a>
          ) : "Connect through Privy to sign gasless match moves."}
        </span>
        {adapter ? <button type="button" onClick={() => void refreshAll()} disabled={Boolean(busyLabel)}>Refresh</button> : null}
      </div>

      {explorerTransaction ? (
        <div className="aos-transaction-ribbon">
          Latest signed move: <a href={explorerTransaction} target="_blank" rel="noreferrer">{shorten(transactionHash!)} ↗</a>
        </div>
      ) : null}

      {view === "matches" ? (
        <section className="aos-match-hall-layout">
          <article className="aos-summoning-panel">
            <div className="aos-summoning-heading">
              <div><p>{hasCurrentMatch ? "CURRENT SUMMONS" : "OPEN A SUMMONS"}</p><h2>{hasCurrentMatch ? match!.matchId : "Choose your challenge"}</h2></div>
              <span className={hasCurrentMatch ? "live" : ""}>{busyLabel ?? (hasCurrentMatch ? match!.status : "READY")}</span>
            </div>
            {!adapter ? (
              <div className="aos-match-hall-empty">
                <span aria-hidden="true">✧</span>
                <h3>Bind a wallet to the Match Hall</h3>
                <p>Privy connects your wallet. Studionet settles match moves gaslessly after you sign them.</p>
                <button className="aos-arcane-cta" type="button" onClick={login} disabled={!ready || !HAS_PVP_DEPLOYMENT}>
                  <span>Connect with Privy</span><b aria-hidden="true">↗</b>
                </button>
              </div>
            ) : hasCurrentMatch ? (
              <div className="aos-active-summons">
                <div className="aos-active-summons-seal" aria-hidden="true"><i /><span>{match!.status === "waiting" ? "⌛" : "✦"}</span></div>
                <div>
                  <p>{match!.status === "waiting" ? "Your challenge is visible in the hall." : "Your duel is already in motion."}</p>
                  <h3>{match!.status === "waiting" ? "Waiting for a rival" : `Turn ${match!.turn} · ${match!.isYourTurn ? "Your move" : "Rival move"}`}</h3>
                  <small>{match!.status === "waiting" ? "The Arena checks automatically for a joining wallet." : `Opponent ${shorten(match!.opponent)}`}</small>
                </div>
                <div className="aos-active-summons-actions">
                  <button className="aos-arcane-cta" type="button" onClick={() => onNavigate("/arena")}>
                    <span>{match!.status === "waiting" ? "Watch in Arena" : "Resume duel"}</span><b aria-hidden="true">↗</b>
                  </button>
                  {match!.status === "waiting" ? (
                    <button className="aos-quiet-button" type="button" onClick={() => void runAction("Cancelling challenge…", () => adapter.cancelMatch())} disabled={Boolean(busyLabel)}>
                      Cancel challenge
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="aos-matchmaker aos-matchmaker-page">
                <button className="aos-open-match-button" type="button" onClick={() => void createMatch(ZERO_ADDRESS)} disabled={Boolean(busyLabel)}>
                  <span><b>Public challenge</b><small>Any connected mage can answer.</small></span><i aria-hidden="true">OPEN</i>
                </button>
                <div className="aos-private-match">
                  <label htmlFor="private-opponent">Private challenge</label>
                  <p>Reserve a match for one wallet address.</p>
                  <div>
                    <input
                      id="private-opponent"
                      type="text"
                      value={inviteAddress}
                      onChange={(event) => setInviteAddress(event.target.value.trim())}
                      placeholder="0x opponent wallet address"
                    />
                    <button type="button" onClick={() => void createMatch(inviteAddress)} disabled={Boolean(busyLabel) || !ADDRESS_PATTERN.test(inviteAddress)}>
                      Create invite
                    </button>
                  </div>
                </div>
              </div>
            )}
            {error ? <p className="aos-page-error" role="alert">{error}</p> : null}
          </article>

          <aside className="aos-hall-rules">
            <p>DUEL CONDITIONS</p>
            <h2>One wallet. One active match.</h2>
            <ol>
              <li><span>01</span><div><b>Twelve-card primal hand</b><small>Begin with three each of Fire, Water, Air, and Earth.</small></div></li>
              <li><span>02</span><div><b>Alternating onchain turns</b><small>Forge, focus, or buy a pack. Each action advances the duel.</small></div></li>
              <li><span>03</span><div><b>Ten XP for victory</b><small>Finalized wins update your title and leaderboard position.</small></div></li>
            </ol>
            <div className="aos-mythic-note"><b>0.5%</b><span>One Man Stand equalizes both mages to 10 health—including anyone already below it.</span></div>
          </aside>
        </section>
      ) : null}

      {view === "leaderboard" ? (
        <>
          <ProfileSummary profile={profile} entries={leaderboard} ranking={leaderboardLoading} />
          {!adapter ? (
            <div className="aos-ranking-connect">
              <span>The Top 100 is public. Connect a wallet to locate your finalized profile within it.</span>
              <button type="button" onClick={login} disabled={!ready}>Connect wallet</button>
            </div>
          ) : null}
          {error ? <p className="aos-page-error" role="alert">{error}</p> : null}
        </>
      ) : null}

      {view === "arena" && match && (match.status === "active" || match.status === "complete") ? (
        <section className="aos-opponent-slot" aria-label="Opponent wallet">
          <Combatant
            name={shorten(match.opponent)}
            title={`Opponent wallet · ${match.opponentHandCount} ingredients`}
            health={match.opponentHealth}
            shield={match.opponentShield}
            lastSpell={match.lastOpponentSpell}
            badge={match.status === "complete" ? "SETTLED" : match.isYourTurn ? "WAITING" : "ACTIVE"}
            fallbackElement="water"
          />
        </section>
      ) : null}

      {view === "arena" ? (
        <section className="aos-arena-layout">
          <div className="aos-arena-stage">
          <div className="aos-rune-ring" aria-hidden="true"><i /><i /><i /></div>
          <EffectLayer effect={effect} />
          <div className={`aos-arena-prompt ${yourTurn ? "forge-open" : ""}`}>
            <span>
              {match && (match.status === "complete" || match.status === "cancelled")
                ? resultCopy(match).eyebrow
                : busyLabel ?? (match?.status === "waiting" ? "MATCH OPEN" : "FORGE & CAST")}
            </span>
            <h2>{arenaTitle}</h2>
            <p>{arenaInstruction}</p>
            {!adapter ? (
              <div className="aos-entry-actions">
                <button type="button" onClick={login} disabled={!ready || !HAS_PVP_DEPLOYMENT}>Connect with Privy</button>
              </div>
            ) : match?.status === "waiting" ? (
              <div className="aos-entry-actions">
                <button type="button" className="secondary" onClick={() => void runAction("Cancelling challenge…", () => adapter.cancelMatch())} disabled={Boolean(busyLabel)}>
                  Cancel challenge
                </button>
              </div>
            ) : !match || match.status === "complete" || match.status === "cancelled" ? (
              <div className="aos-entry-actions">
                <button type="button" onClick={() => onNavigate("/matches")}>Open Match Hall</button>
              </div>
            ) : !match.isYourTurn ? (
              <button type="button" onClick={() => void refreshAll()} disabled={Boolean(busyLabel)}>Check opponent move</button>
            ) : (
              <div className="aos-incantation-panel aos-fusion-builder">
                <div className="aos-selected-ingredients" aria-label="Selected fusion ingredients">
                  {selectedCards.length === 0 ? <small>No ingredients selected</small> : selectedCards.map((card, index) => (
                    <span className={`element-${card.element}`} key={`${card.id}-${selectedIngredients[index]}`}>
                      <b>{card.glyph}</b>{card.name}
                    </span>
                  ))}
                  <em>{selectedCards.length === 3 ? "Grand" : selectedCards.length === 2 ? "Dual" : `${selectedCards.length}/3`}</em>
                </div>
                <label htmlFor="spell-incantation">Declare your spell intent</label>
                <textarea
                  id="spell-incantation"
                  value={incantation}
                  onChange={(event) => setIncantation(event.target.value)}
                  maxLength={240}
                  placeholder="Example: Bind fire and water into scalding steam that crashes into my rival."
                  disabled={Boolean(busyLabel)}
                />
                <div className="aos-incantation-meta">
                  <span>12–240 characters · consensus interpreted</span>
                  <b className={normalizedIncantation.length > 0 && !incantationIsValid ? "invalid" : ""}>
                    {normalizedIncantation.length}/240
                  </b>
                </div>
                {hasOneManStand && selectedCards.length < 3 ? (
                  <p className="aos-fusion-warning">One Man Stand needs two companion ingredients.</p>
                ) : null}
                <div className="aos-entry-actions">
                  <button type="button" onClick={() => void forgeAndCast()} disabled={Boolean(busyLabel) || !forgeReady}>
                    Forge & Cast
                  </button>
                  <button type="button" className="secondary" onClick={clearForgeInput} disabled={Boolean(busyLabel) || (selectedCards.length === 0 && !incantation)}>
                    Clear
                  </button>
                </div>
                <small className="aos-authority-note">AI chooses the spell identity within your selected affinities. The contract applies fixed, verified power values.</small>
              </div>
            )}
            {error ? <p className="aos-duel-error" role="alert">{error}</p> : null}
          </div>
          </div>

          <aside className="aos-combat-log">
          <div className="aos-log-heading">
            <span>Match chronicle</span>
            {isActive ? (
              <button type="button" onClick={() => void runAction("Conceding match…", () => adapter!.concedeMatch())} disabled={Boolean(busyLabel)}>
                Concede
              </button>
            ) : null}
          </div>
          {latestSpell ? <ForgedSpellSummary spell={latestSpell} /> : null}
          <ol>
            {[...(match?.log ?? ["No match has begun."])].reverse().map((entry, index) => (
              <li key={`${entry}-${index}`}>
                <span>{String(Math.max(0, (match?.revision ?? 0) - index)).padStart(2, "0")}</span>
                <p>{entry}</p>
              </li>
            ))}
          </ol>
          </aside>
        </section>
      ) : null}

      {view === "arena" && match && (match.status === "active" || match.status === "complete") ? (
        <section className="aos-player-row">
          <Combatant
            name={playerName}
            title="Connected wallet · You"
            health={match.yourHealth}
            shield={match.yourShield}
            lastSpell={match.lastYourSpell}
            badge={match.status === "complete" ? "SETTLED" : match.isYourTurn ? "ACTIVE" : "WAITING"}
            fallbackElement="fire"
          />
          <div className="aos-turn-actions">
            <div><span>Match gold</span><strong>{match.yourGold}</strong></div>
            <div><span>Ingredients</span><strong>{match.hand.length}/{MATCH_MAX_HAND}</strong></div>
            <div><span>Best streak</span><strong>{profile.bestStreak}</strong></div>
          </div>
        </section>
      ) : null}

      {view === "arena" && isActive ? (
        <section className="aos-economy-bar" aria-label="Match economy actions">
          <div><span>ARCANE MARKET</span><p>Packs follow the contract rarity table. Focusing or buying a pack consumes your turn; only Forge & Cast creates a spell.</p></div>
          <button type="button" onClick={() => void buyPack("standard")} disabled={!yourTurn || Boolean(busyLabel) || match!.yourGold < STANDARD_PACK_COST || match!.hand.length > MATCH_MAX_HAND - STANDARD_PACK_SIZE}>
            Standard pack <b>{STANDARD_PACK_COST} gold · draw {STANDARD_PACK_SIZE} · ends turn</b>
          </button>
          <button type="button" onClick={() => void buyPack("arcane")} disabled={!yourTurn || Boolean(busyLabel) || match!.yourGold < ARCANE_PACK_COST || match!.hand.length > MATCH_MAX_HAND - ARCANE_PACK_SIZE}>
            Arcane pack <b>{ARCANE_PACK_COST} gold · {ARCANE_PACK_SIZE} best-of-2 pulls · ends turn</b>
          </button>
          <button type="button" className="wait" onClick={() => void runAction("Focusing and drawing…", () => adapter!.focusTurn())} disabled={!yourTurn || Boolean(busyLabel) || match!.hand.length >= MATCH_MAX_HAND}>
            Focus <b>Draw up to 2 · ends turn</b>
          </button>
        </section>
      ) : null}

      {view === "arena" && isActive ? (
        <section className="aos-hand-section">
          <div className="aos-hand-heading">
            <div><p>YOUR INGREDIENTS</p><h2>Select two for a Dual Fusion, or three for a Grand Fusion</h2></div>
            <span>{yourTurn ? `${match!.yourGold} gold · ${selectedCards.length}/3 selected` : "Your hand is locked during the rival turn"}</span>
          </div>
          <HorizontalCardRail className="aos-card-hand" label="Your ingredient hand">
            {match!.hand.map((cardId, index) => {
              const card = INGREDIENT_BY_ID.get(cardId);
              if (!card) return null;
              const selected = selectedIngredients.includes(index);
              const selectionFull = selectedIngredients.length >= 3 && !selected;
              return (
                <SpellCard
                  key={`${card.id}-${index}`}
                  card={card}
                  selected={selected}
                  disabled={!yourTurn || Boolean(busyLabel) || selectionFull}
                  onSelect={() => handleIngredientSelect(index)}
                />
              );
            })}
          </HorizontalCardRail>
        </section>
      ) : null}

      {view === "matches" && adapter && (!match || match.status === "complete" || match.status === "cancelled") ? (
        <Lobby entries={lobby} player={profile.player} busy={Boolean(busyLabel)} onJoin={(matchId) => void joinMatch(matchId)} />
      ) : null}
      {view === "leaderboard" ? <Leaderboard entries={leaderboard} player={profile.player} loading={leaderboardLoading} /> : null}
    </main>
  );
}
