import { applyAppearance, assertAppearance } from './appearance.js';
import { buildMaytesLogo } from './branding.js';
import { MaytesError, MaytesErrorCode } from './errors.js';
import { assertLaunchMode, assertRedirectOverlay, launchCheckout } from './launch.js';
import { watchShown } from './shown.js';
import { ensureStylesInjected, releaseStyles } from './styles.js';
import type { InstanceState } from './state.js';
import type { RenderButtonCleanup, RenderButtonOptions } from './types.js';

export { closePopupWindow, stopPopupPoll } from './launch.js';

function buildLogo(): SVGSVGElement {
  const svg = buildMaytesLogo('1em', 'currentColor');
  svg.setAttribute('class', 'maytes-checkout-button__logo');
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}

function buildSpinner(): HTMLSpanElement {
  const spinner = document.createElement('span');
  spinner.className = 'maytes-checkout-button__spinner';
  spinner.setAttribute('aria-hidden', 'true');
  return spinner;
}

export function renderButton(
  state: InstanceState,
  container: HTMLElement,
  options: RenderButtonOptions = {},
): RenderButtonCleanup {
  if (state.destroyed) {
    throw new MaytesError(
      MaytesErrorCode.Config,
      'renderButton() called on a destroyed Maytes instance',
    );
  }
  if (!(container instanceof HTMLElement)) {
    throw new MaytesError(MaytesErrorCode.Config, 'renderButton(container) requires an HTMLElement');
  }

  const appearance = assertAppearance(options);
  const redirectOverlay = assertRedirectOverlay(options.redirectOverlay);

  ensureStylesInjected(state.config.cspNonce);

  const label = options.label ?? 'Split with';
  const block = options.block === true;
  const mode = assertLaunchMode(options.mode ?? 'popup');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = block
    ? 'maytes-checkout-button maytes-checkout-button--block'
    : 'maytes-checkout-button';
  applyAppearance(button, appearance);
  button.setAttribute('aria-label', `${label} Maytes`);

  const labelNode = document.createTextNode(`${label} `);
  let icon: SVGSVGElement | HTMLSpanElement = buildLogo();
  button.appendChild(labelNode);
  button.appendChild(icon);

  const showBusy = (busy: boolean): void => {
    if (busy) {
      button.setAttribute('aria-disabled', 'true');
      button.setAttribute('aria-busy', 'true');
      const spinner = buildSpinner();
      icon.replaceWith(spinner);
      icon = spinner;
    } else {
      button.removeAttribute('aria-disabled');
      button.removeAttribute('aria-busy');
      const nextLogo = buildLogo();
      icon.replaceWith(nextLogo);
      icon = nextLogo;
    }
  };
  let launchedHere = false;
  const followOwnLaunch = (busy: boolean): void => {
    if (!launchedHere) return;
    showBusy(busy);
    if (!busy) launchedHere = false;
  };
  state.busyViews.add(followOwnLaunch);

  const handleClick = (): void => {
    if (state.busy || state.destroyed) return;
    launchedHere = true;
    void launchCheckout(state, mode, 'button', redirectOverlay);
  };

  button.addEventListener('click', handleClick);
  container.appendChild(button);

  let cleaned = false;
  let stopWatching: (() => void) | undefined;
  const teardown = (): void => {
    if (cleaned) return;
    cleaned = true;
    stopWatching?.();
    button.removeEventListener('click', handleClick);
    button.remove();
    state.busyViews.delete(followOwnLaunch);
    state.teardowns.delete(teardown);
    releaseStyles();
  };
  state.teardowns.add(teardown);
  stopWatching = watchShown(button, state.config.environment);

  return teardown;
}
