import {lazy, Suspense, useCallback, useEffect, useState} from "react";

import HomePage from "./HomePage";
import type {GameView} from "./PvpBattle";
import {pushAppPath, resolveAppPath, type AppPath} from "./app-route";

const HowToPlayPage = lazy(() => import("./HowToPlayPage"));
const PvpBattle = lazy(() => import("./PvpBattle"));

function RouteFallback() {
  return (
    <main className="configuration-shell" aria-busy="true">
      <div className="configuration-card" role="status">
        <img className="configuration-logo" src="/brand/age-of-spells-elemental-mark-v2.webp" alt="" width="82" height="82" />
        <p className="eyebrow">Opening the grimoire</p>
        <h1>Gathering the elements…</h1>
      </div>
    </main>
  );
}

export default function App() {
  const [activePath, setActivePath] = useState<AppPath>(() => resolveAppPath(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => setActivePath(resolveAppPath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((path: AppPath) => pushAppPath(path), []);

  if (activePath === "/") return <HomePage onNavigate={navigate} />;
  if (activePath === "/how-to-play") {
    return <Suspense fallback={<RouteFallback />}><HowToPlayPage onNavigate={navigate} /></Suspense>;
  }

  const view: GameView = activePath === "/matches"
    ? "matches"
    : activePath === "/leaderboard"
      ? "leaderboard"
      : "arena";
  return <Suspense fallback={<RouteFallback />}><PvpBattle view={view} onNavigate={navigate} /></Suspense>;
}
