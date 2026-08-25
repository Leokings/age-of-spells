import type {MouseEvent, ReactNode} from "react";

import type {AppPath} from "../app-route";
import SiteBrand from "./SiteBrand";

const NAV_ITEMS: readonly {path: AppPath; label: string}[] = [
  {path: "/", label: "Home"},
  {path: "/how-to-play", label: "Guide"},
  {path: "/matches", label: "Match Hall"},
  {path: "/arena", label: "Arena"},
  {path: "/leaderboard", label: "Leaderboard"},
];

type SiteHeaderProps = {
  activePath: AppPath;
  onNavigate: (path: AppPath) => void;
  walletAction: ReactNode;
};

export default function SiteHeader({activePath, onNavigate, walletAction}: SiteHeaderProps) {
  function handleNavigate(event: MouseEvent<HTMLAnchorElement>, path: AppPath) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(path);
  }

  return (
    <header className="aos-site-header">
      <a className="aos-site-brand-link" href="/" aria-label="Age of Spells home" onClick={(event) => handleNavigate(event, "/")}>
        <SiteBrand />
      </a>
      <nav className="aos-primary-nav" aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => (
          <a
            className={activePath === item.path ? "active" : ""}
            href={item.path}
            onClick={(event) => handleNavigate(event, item.path)}
            aria-current={activePath === item.path ? "page" : undefined}
            key={item.path}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div className="aos-site-wallet-action">{walletAction}</div>
    </header>
  );
}
