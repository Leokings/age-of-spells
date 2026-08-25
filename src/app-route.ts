export type AppPath = "/" | "/how-to-play" | "/matches" | "/arena" | "/leaderboard";

export function resolveAppPath(pathname: string): AppPath {
  if (
    pathname === "/how-to-play" ||
    pathname === "/matches" ||
    pathname === "/arena" ||
    pathname === "/leaderboard"
  ) {
    return pathname;
  }
  return "/";
}

export function pushAppPath(path: AppPath): void {
  if (window.location.pathname !== path) window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({top: 0, behavior: "smooth"});
}
