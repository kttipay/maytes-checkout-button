import type { InternalEnvironment } from './env.js';

export const SHOWN_URL = 'https://js.maytes.co/button-shown.txt';
export const SHOWN_PATHS_KEY = '__maytes_checkout_button_shown_paths__';

const REPORTING_ENVIRONMENTS: ReadonlySet<InternalEnvironment> = new Set(['production', 'staging']);
const VISIBLE_RATIO = 0.5;

type ShownWindow = Window & { [SHOWN_PATHS_KEY]?: Set<string> };

const ignore = (): void => {};

function sendOncePerPath(): void {
  const shownWindow = window as ShownWindow;
  const paths = (shownWindow[SHOWN_PATHS_KEY] ??= new Set<string>());
  const path = window.location.pathname;
  if (paths.has(path)) return;
  paths.add(path);
  Promise.resolve(
    fetch(SHOWN_URL, {
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'strict-origin',
      keepalive: true,
    }),
  ).catch(ignore);
}

export function watchShown(button: Element, environment: InternalEnvironment): () => void {
  if (!REPORTING_ENVIRONMENTS.has(environment)) return ignore;
  if (typeof IntersectionObserver !== 'function' || typeof fetch !== 'function') return ignore;

  let observer: IntersectionObserver | null = null;
  let onScreen = false;

  const stop = (): void => {
    document.removeEventListener('visibilitychange', report);
    try {
      observer?.disconnect();
    } catch {}
    observer = null;
  };

  const report = (): void => {
    if (!onScreen || document.visibilityState !== 'visible') return;
    try {
      stop();
      sendOncePerPath();
    } catch {}
  };

  try {
    observer = new IntersectionObserver(
      (entries) => {
        const latest = entries[entries.length - 1];
        onScreen = latest?.isIntersecting === true && latest.intersectionRatio >= VISIBLE_RATIO;
        report();
      },
      { threshold: VISIBLE_RATIO },
    );
    document.addEventListener('visibilitychange', report);
    observer.observe(button);
  } catch {
    stop();
  }

  return stop;
}
