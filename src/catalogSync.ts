interface ActivityTarget {
  addEventListener(type: string, callback: () => void): void;
  removeEventListener(type: string, callback: () => void): void;
}
export interface CatalogActivityEnvironment {
  window: ActivityTarget;
  document: ActivityTarget & { readonly visibilityState: string };
  navigator: { readonly onLine: boolean };
  now: () => number;
}
function browserEnvironment(): CatalogActivityEnvironment {
  return {
    window,
    document,
    navigator,
    now: () => window.performance.now(),
  };
}

/** Check on opening or returning after the caller's initial load. No polling or online timer. */
export function watchCatalogActivity(
  check: () => void | Promise<void>,
  environment: CatalogActivityEnvironment = browserEnvironment(),
): () => void {
  let stopped = false,
    running = false,
    pending = false,
    lastStarted = -Infinity;
  const eligible = () =>
    !stopped &&
    environment.document.visibilityState === "visible" &&
    environment.navigator.onLine;
  function start() {
    if (!eligible() || running) return;
    running = true;
    lastStarted = environment.now();
    void (async () => {
      try {
        await check();
      } catch {
        /* A background refresh failure must not stop subsequent checks. */
      } finally {
        running = false;
        const repeat = pending;
        pending = false;
        if (repeat && eligible()) start();
      }
    })();
  }
  function activity() {
    if (!eligible() || environment.now() - lastStarted < 1000) return;
    if (running) pending = true;
    else start();
  }
  for (const event of ["focus", "pageshow"])
    environment.window.addEventListener(event, activity);
  environment.document.addEventListener("visibilitychange", activity);
  return () => {
    if (stopped) return;
    stopped = true;
    pending = false;
    for (const event of ["focus", "pageshow"])
      environment.window.removeEventListener(event, activity);
    environment.document.removeEventListener("visibilitychange", activity);
  };
}
