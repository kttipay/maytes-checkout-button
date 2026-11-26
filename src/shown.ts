import type { InternalEnvironment } from './env.js';
import { SDK_VERSION } from './version.js';

export const SHOWN_URL = 'https://js.maytes.co/button-shown.txt';
export const SHOWN_PATHS_KEY = '__maytes_checkout_button_shown_paths__';

const VISIBLE_RATIO = 0.5;

type ShownWindow = Window & { [SHOWN_PATHS_KEY]?: Set<string> };

const ignore = (): void => {};

function shownRequestUrl(environment: InternalEnvironment): string {
  return `${SHOWN_URL}?${new URLSearchParams({ v: SDK_VERSION, env: environment })}`;
}

function sendOncePerPath(environment: InternalEnvironment): void {
  const shownWindow = window as ShownWindow;
  const paths = (shownWindow[SHOWN_PATHS_KEY] ??= new Set<string>());
  const path = window.location.pathname;
  if (paths.has(path)) return;
  paths.add(path);
  Promise.resolve(
    fetch(shownRequestUrl(environment), {
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'strict-origin',
      keepalive: true,
    }),
  ).catch(ignore);
}

export function watchShown(button: Element, environment: InternalEnvironment): () => void {
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
      sendOncePerPath(environment);
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
