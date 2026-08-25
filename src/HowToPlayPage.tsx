import {useEffect, useRef} from "react";
import {usePrivy} from "@privy-io/react-auth";

import type {AppPath} from "./app-route";
import {INGREDIENTS} from "./cards";
import HorizontalCardRail from "./components/HorizontalCardRail";
import SiteBrand from "./components/SiteBrand";
import SiteHeader from "./components/SiteHeader";
import SpellCard from "./components/SpellCard";

type HowToPlayPageProps = {
  onNavigate: (path: AppPath) => void;
};

const QUICK_START = [
  {
    number: "01",
    title: "Connect your wallet",
    copy: "Use Privy to connect. You sign each move, while GenLayer Studionet settles the game action gaslessly.",
  },
  {
    number: "02",
    title: "Find a rival",
    copy: "Open a public challenge, invite one wallet privately, or join a challenge already waiting in the Match Hall.",
  },
  {
    number: "03",
    title: "Enter the Arena",
    copy: "Both mages begin with 100 health, no shield, 8 gold, and the same twelve-card primal hand.",
  },
  {
    number: "04",
    title: "Choose one action",
    copy: "Forge a spell, focus for cards, or buy one pack. Every completed action passes the turn to your rival.",
  },
  {
    number: "05",
    title: "Write the spell",
    copy: "Burn two cards for a Dual Fusion or three for a Grand Fusion, then describe your intent in 12–240 characters.",
  },
  {
    number: "06",
    title: "Claim victory",
    copy: "Reduce the rival to 0 health—or accept their concession—to earn 10 finalized XP and climb the rankings.",
  },
] as const;

const TURN_ACTIONS = [
  {
    glyph: "✦",
    name: "Forge & Cast",
    cost: "Burn 2–3 cards",
    result: "Creates and resolves one intelligent spell, then ends your turn.",
  },
  {
    glyph: "◎",
    name: "Focus",
    cost: "0 gold",
    result: "Draw up to 2 normal ingredients, then end your turn.",
  },
  {
    glyph: "◇",
    name: "Standard Pack",
    cost: "2 gold",
    result: "Draw 2 cards from the normal rarity table, then end your turn.",
  },
  {
    glyph: "⬡",
    name: "Arcane Pack",
    cost: "4 gold",
    result: "Draw 3 enhanced cards using the rarer result from two pulls each, then end your turn.",
  },
] as const;

const POWER_ROWS = [
  {effect: "Damage", dual: "20 damage", grand: "28 damage", note: "Shield absorbs it before health."},
  {effect: "Piercing", dual: "14 health", grand: "20 health", note: "Bypasses the rival's shield."},
  {effect: "Healing", dual: "20 health", grand: "28 health", note: "Cannot raise health above 100."},
  {effect: "Shield", dual: "24 shield", grand: "34 shield", note: "Cannot raise shield above 50."},
  {effect: "Fortify", dual: "10 damage + 12 shield", grand: "16 damage + 18 shield", note: "Requires damage and shield affinities."},
  {effect: "Drain", dual: "12 damage + 7 healing", grand: "18 damage + 10 healing", note: "Requires Shadow, or damage plus healing affinities."},
] as const;

const INCANTATION_EXAMPLES = [
  {
    cards: "Fire + Water",
    intent: "Damage",
    spell: "Bind fire and water into scalding steam that crashes into my rival.",
  },
  {
    cards: "Water + Earth",
    intent: "Shield",
    spell: "Raise a flowing wall of riverstone around me and hold the enemy back.",
  },
  {
    cards: "Air + Metal",
    intent: "Piercing",
    spell: "Drive a silver gale through the rival's ward and strike the life behind it.",
  },
  {
    cards: "Water + Light",
    intent: "Healing",
    spell: "Let a luminous tide close my wounds and return my strength.",
  },
] as const;

const TITLE_TIERS = [
  {title: "Apprentice", xp: "0 XP"},
  {title: "Spellweaver", xp: "30 XP"},
  {title: "Arcanist", xp: "80 XP"},
  {title: "High Mage", xp: "160 XP"},
  {title: "Archmage", xp: "300 XP"},
] as const;

function shorten(value: string): string {
  return value.length > 14 ? `${value.slice(0, 7)}…${value.slice(-5)}` : value;
}

export default function HowToPlayPage({onNavigate}: HowToPlayPageProps) {
  const {ready, authenticated, login, user} = usePrivy();
  const enterAfterAuthentication = useRef(false);
  const address = user?.wallet?.address ?? "";

  useEffect(() => {
    if (!authenticated || !enterAfterAuthentication.current) return;
    enterAfterAuthentication.current = false;
    onNavigate("/matches");
  }, [authenticated, onNavigate]);

  function enterMatchHall() {
    if (authenticated) {
      onNavigate("/matches");
      return;
    }
    enterAfterAuthentication.current = true;
    login();
  }

  const walletAction = authenticated ? (
    <button className="aos-header-wallet connected" type="button" onClick={() => onNavigate("/matches")}>
      <span />{address ? shorten(address) : "Enter Match Hall"}
    </button>
  ) : (
    <button className="aos-header-wallet" type="button" onClick={enterMatchHall} disabled={!ready}>
      Connect wallet
    </button>
  );

  return (
    <main className="aos-site-shell aos-guide-page">
      <SiteHeader activePath="/how-to-play" onNavigate={onNavigate} walletAction={walletAction} />

      <section className="aos-guide-hero">
        <div>
          <p className="aos-kicker"><span />THE PLAYER'S GRIMOIRE · OFFICIAL RULES</p>
          <h1>Learn the ritual.<br /><em>Shape the spell.</em></h1>
          <p>
            Age of Spells is a two-player, turn-based elemental duel. Your cards decide what is possible;
            your incantation decides what the magic becomes.
          </p>
          <div className="aos-home-actions">
            <button className="aos-arcane-cta" type="button" onClick={enterMatchHall} disabled={!ready}>
              <span>{authenticated ? "Enter the Match Hall" : "Connect & Play"}</span><b aria-hidden="true">↗</b>
            </button>
            <a href="#quick-start">Begin the tutorial</a>
          </div>
        </div>
        <div className="aos-guide-seal" aria-hidden="true">
          <i />
          <img src="/brand/age-of-spells-elemental-mark-v2.webp" alt="" width="420" height="420" />
          <span>THE FOUR PRIMALS</span>
        </div>
      </section>

      <nav className="aos-guide-index" aria-label="Tutorial chapters">
        <a href="#quick-start"><span>01</span> Quick start</a>
        <a href="#your-turn"><span>02</span> Your turn</a>
        <a href="#spellcraft"><span>03</span> Spellcraft</a>
        <a href="#incantations"><span>04</span> Incantations</a>
        <a href="#victory"><span>05</span> Victory & XP</a>
      </nav>

      <section className="aos-guide-section" id="quick-start" aria-labelledby="quick-start-heading">
        <div className="aos-guide-heading">
          <span>CHAPTER 01</span>
          <div><p>FROM WALLET TO FIRST SPELL</p><h2 id="quick-start-heading">Quick start</h2></div>
          <p>Public and private challenges use the same rules. The challenge creator takes the opening turn.</p>
        </div>
        <div className="aos-guide-steps">
          {QUICK_START.map((step) => (
            <article key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
        <div className="aos-starting-state" aria-label="Starting duel state">
          <div><span>HEALTH</span><strong>100</strong><small>Lose at zero</small></div>
          <div><span>SHIELD</span><strong>0 / 50</strong><small>Absorbs normal damage</small></div>
          <div><span>GOLD</span><strong>8</strong><small>Spend it on packs</small></div>
          <div><span>HAND</span><strong>12</strong><small>3 of each primal</small></div>
        </div>
      </section>

      <section className="aos-guide-section" id="your-turn" aria-labelledby="your-turn-heading">
        <div className="aos-guide-heading">
          <span>CHAPTER 02</span>
          <div><p>ONE ACTION · THEN PASS</p><h2 id="your-turn-heading">What you can do</h2></div>
          <p>When your rival finishes, you automatically draw one normal ingredient if your hand has room.</p>
        </div>
        <div className="aos-turn-guide-grid">
          {TURN_ACTIONS.map((action) => (
            <article key={action.name}>
              <b aria-hidden="true">{action.glyph}</b>
              <div><span>{action.cost}</span><h3>{action.name}</h3><p>{action.result}</p></div>
            </article>
          ))}
        </div>
        <aside className="aos-guide-note">
          <b>Hand limit: 12</b>
          <p>You cannot buy a pack unless every new card will fit. Focus is unavailable while your hand is full.</p>
        </aside>
      </section>

      <section className="aos-guide-section" id="spellcraft" aria-labelledby="spellcraft-heading">
        <div className="aos-guide-heading">
          <span>CHAPTER 03</span>
          <div><p>CARDS DEFINE THE BOUNDARY</p><h2 id="spellcraft-heading">How spellcraft works</h2></div>
          <p>Affinities determine the effects the intelligent contract may choose. Card combinations do not use a fixed recipe list.</p>
        </div>

        <div className="aos-fusion-explainer">
          <article>
            <span>DUAL FUSION</span>
            <strong>2 cards</strong>
            <p>One primary effect. Reliable, efficient, and easier to assemble.</p>
          </article>
          <div aria-hidden="true">✦</div>
          <article>
            <span>GRAND FUSION</span>
            <strong>3 cards</strong>
            <p>A stronger primary effect and, when compatible, one smaller secondary effect.</p>
          </article>
        </div>

        <div className="aos-guide-authority-grid">
          <article>
            <p>THE INTELLIGENT COUNCIL</p>
            <h3>Interprets identity</h3>
            <ul>
              <li>Reads only the cards you selected</li>
              <li>Understands the intent of your incantation</li>
              <li>Creates the spell name, fusion family, element, and description</li>
              <li>Chooses only effects supported by your combined affinities</li>
            </ul>
          </article>
          <article>
            <p>THE CONTRACT</p>
            <h3>Enforces power</h3>
            <ul>
              <li>Verifies the cards are really in your hand</li>
              <li>Rejects unsupported effects or unselected elements</li>
              <li>Applies fixed damage, healing, shield, and piercing values</li>
              <li>Burns the cards, advances the turn, and finalizes XP</li>
            </ul>
          </article>
        </div>

        <HorizontalCardRail className="aos-guide-card-grid" label="Ingredient codex cards">
          {INGREDIENTS.map((card) => <SpellCard card={card} displayOnly compact key={card.id} />)}
        </HorizontalCardRail>

        <div className="aos-power-table-wrap">
          <table className="aos-power-table">
            <caption>Fixed gameplay power by fusion tier</caption>
            <thead><tr><th>Effect</th><th>Dual fusion</th><th>Grand fusion</th><th>Rule</th></tr></thead>
            <tbody>
              {POWER_ROWS.map((row) => (
                <tr key={row.effect}><th scope="row">{row.effect}</th><td>{row.dual}</td><td>{row.grand}</td><td>{row.note}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="aos-secondary-rule">
          <b>Grand secondary effects:</b> a compatible three-card fusion may add 10 damage, 7 piercing damage,
          10 healing, or 12 shield. The Council cannot invent extra turns, instant wins, or unlisted powers.
        </p>
        <aside className="aos-mythic-guide">
          <div><span>0.5%</span><strong>MYTHIC PULL</strong></div>
          <div>
            <h3>One Man Stand</h3>
            <p>It must be burned with two companion cards. Its Grand Fusion sets both mages to exactly 10 health—even a mage already below 10.</p>
          </div>
        </aside>
      </section>

      <section className="aos-guide-section" id="incantations" aria-labelledby="incantations-heading">
        <div className="aos-guide-heading">
          <span>CHAPTER 04</span>
          <div><p>WORDS SHAPE THE MAGIC</p><h2 id="incantations-heading">Writing a strong incantation</h2></div>
          <p>Say what the selected elements become and what you want the spell to do. Be imaginative, but remain inside their affinities.</p>
        </div>
        <div className="aos-incantation-formula" aria-label="Incantation formula">
          <span>Selected elements</span><b>+</b><span>Magical transformation</span><b>+</b><span>Supported battle intent</span>
        </div>
        <div className="aos-incantation-examples">
          {INCANTATION_EXAMPLES.map((example) => (
            <article key={example.cards}>
              <div><span>{example.cards}</span><b>{example.intent}</b></div>
              <blockquote>“{example.spell}”</blockquote>
            </article>
          ))}
        </div>
        <div className="aos-incantation-rules">
          <article className="good">
            <span>DO</span>
            <ul>
              <li>Use two or three cards actually present in your hand</li>
              <li>Write at least 12 clear characters</li>
              <li>Describe one main battle purpose</li>
              <li>Use metaphor freely without treating it as a new card</li>
            </ul>
          </article>
          <article className="bad">
            <span>AVOID</span>
            <ul>
              <li>Naming an element or catalyst you did not select</li>
              <li>Requesting healing without a healing affinity</li>
              <li>Demanding invented numbers, instant wins, or extra turns</li>
              <li>Writing random or contradictory instructions</li>
            </ul>
          </article>
        </div>
        <p className="aos-guide-note full">
          <b>Important:</b> examples are creative patterns, not guaranteed recipes. Different valid wording can produce a different spell name or visual element while preserving the same supported gameplay intent.
        </p>
      </section>

      <section className="aos-guide-section" id="victory" aria-labelledby="victory-heading">
        <div className="aos-guide-heading">
          <span>CHAPTER 05</span>
          <div><p>THE ASCENDANT PATH</p><h2 id="victory-heading">Victory, XP, and titles</h2></div>
          <p>A knockout or concession settles the duel on Studionet. The winner gains 10 XP; a loss resets the current win streak.</p>
        </div>
        <ol className="aos-title-ladder">
          {TITLE_TIERS.map((tier, index) => (
            <li key={tier.title}><span>{String(index + 1).padStart(2, "0")}</span><strong>{tier.title}</strong><b>{tier.xp}</b></li>
          ))}
        </ol>
        <div className="aos-ranking-explainer">
          <div><strong>TOP 100</strong><span>appear on the global leaderboard</span></div>
          <p>Every player can still see their personal rank and title progression in their profile, even when they are outside the public top one hundred.</p>
          <button type="button" onClick={() => onNavigate("/leaderboard")}>View leaderboard</button>
        </div>
      </section>

      <section className="aos-guide-final-cta">
        <SiteBrand />
        <div><p>THE RITUAL IS YOURS NOW</p><h2>Forge the spell no one else would imagine.</h2></div>
        <button className="aos-arcane-cta" type="button" onClick={enterMatchHall} disabled={!ready}>
          <span>{authenticated ? "Open Match Hall" : "Connect & Begin"}</span><b aria-hidden="true">↗</b>
        </button>
      </section>
    </main>
  );
}
