import {useEffect, useRef} from "react";
import {usePrivy} from "@privy-io/react-auth";

import type {AppPath} from "./app-route";
import {INGREDIENTS} from "./cards";
import HorizontalCardRail from "./components/HorizontalCardRail";
import SiteBrand from "./components/SiteBrand";
import SiteHeader from "./components/SiteHeader";
import SpellCard from "./components/SpellCard";

type HomePageProps = {
  onNavigate: (path: AppPath) => void;
};

function shorten(value: string): string {
  return value.length > 14 ? `${value.slice(0, 7)}…${value.slice(-5)}` : value;
}

const HOME_STEPS = [
  {
    number: "01",
    title: "Draw your ingredients",
    copy: "Every mage begins with twelve primal cards: three each of Fire, Water, Air, and Earth.",
  },
  {
    number: "02",
    title: "Burn two or three",
    copy: "Combine primal elements and rarer catalysts. A single card can never become a spell by itself.",
  },
  {
    number: "03",
    title: "Speak your intent",
    copy: "The intelligent contract interprets your incantation, then bounded rules settle damage, healing, shields, or piercing.",
  },
] as const;

export default function HomePage({onNavigate}: HomePageProps) {
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
    <main className="aos-site-shell aos-home-page">
      <SiteHeader activePath="/" onNavigate={onNavigate} walletAction={walletAction} />

      <section className="aos-home-hero">
        <div className="aos-home-copy">
          <p className="aos-kicker"><span />INTELLIGENT ELEMENTAL PVP · GENLAYER STUDIONET</p>
          <h1>Every spell begins with what you <em>burn.</em></h1>
          <p className="aos-home-intro">
            Fuse elemental cards, write the incantation, and let an intelligent contract forge a spell that has never existed before.
          </p>
          <div className="aos-home-actions">
            <button className="aos-arcane-cta" type="button" onClick={enterMatchHall} disabled={!ready}>
              <span>{authenticated ? "Enter the Match Hall" : "Connect & Enter"}</span>
              <b aria-hidden="true">↗</b>
            </button>
            <a href="#elemental-codex">Explore the elements</a>
            <button className="aos-home-guide-link" type="button" onClick={() => onNavigate("/how-to-play")}>How to play</button>
          </div>
          <dl className="aos-home-stats">
            <div><dt>Opening hand</dt><dd>12 cards</dd></div>
            <div><dt>Fusion size</dt><dd>2–3 cards</dd></div>
            <div><dt>Victory reward</dt><dd>10 XP</dd></div>
          </dl>
        </div>

        <div className="aos-home-sigil" aria-label="The four primal elements of Age of Spells">
          <span className="aos-sigil-orbit orbit-one" aria-hidden="true" />
          <span className="aos-sigil-orbit orbit-two" aria-hidden="true" />
          <img
            src="/brand/age-of-spells-elemental-mark-v2.webp"
            alt="Age of Spells elemental sigil"
            width="620"
            height="620"
            fetchPriority="high"
          />
          <div className="aos-sigil-caption"><span>THE FOUR PRIMALS</span><strong>Infinite outcomes</strong></div>
        </div>
      </section>

      <section className="aos-home-manifesto" aria-label="Game promise">
        <p>Not a fixed spellbook.</p>
        <strong>Your cards set the boundaries. Your words shape the magic.</strong>
        <span>Consensus validators interpret identity; the contract keeps every power value fair.</span>
      </section>

      <section className="aos-codex-section" id="elemental-codex" aria-labelledby="codex-heading">
        <div className="aos-section-heading">
          <div>
            <p>THE ELEMENTAL CODEX</p>
            <h2 id="codex-heading">Four foundations.<br />No fixed recipes.</h2>
          </div>
          <p>Each card carries explicit affinities. Combine them, then declare how you want their shared nature to manifest.</p>
        </div>
        <HorizontalCardRail className="aos-codex-cards" label="Primal element cards">
          {INGREDIENTS.slice(0, 4).map((card) => (
            <SpellCard card={card} displayOnly compact key={card.id} />
          ))}
        </HorizontalCardRail>
      </section>

      <section className="aos-how-section" aria-labelledby="how-heading">
        <div className="aos-section-heading compact">
          <div><p>THE RITUAL</p><h2 id="how-heading">How a duel unfolds</h2></div>
        </div>
        <div className="aos-how-grid">
          {HOME_STEPS.map((step) => (
            <article key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
        <div className="aos-home-final-cta">
          <SiteBrand compact />
          <div><p>YOUR NEXT SPELL DOES NOT EXIST YET</p><h2>Find a rival and create it.</h2></div>
          <button className="aos-arcane-cta" type="button" onClick={enterMatchHall} disabled={!ready}>
            <span>{authenticated ? "Open Match Hall" : "Connect wallet"}</span><b aria-hidden="true">↗</b>
          </button>
        </div>
      </section>

      <footer className="aos-site-footer">
        <SiteBrand compact />
        <p>Wallet-owned duels · Gasless moves · GenLayer Studionet</p>
        <div className="aos-footer-links">
          <button type="button" onClick={() => onNavigate("/how-to-play")}>How to play</button>
          <button type="button" onClick={() => onNavigate("/leaderboard")}>View leaderboard</button>
        </div>
      </footer>
    </main>
  );
}
