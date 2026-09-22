import { resetStylesForTests } from '../styles.js';

export function resetMaytesDomForTests(): void {
  resetStylesForTests();
  document.querySelectorAll('[data-maytes-overlay]').forEach((el) => el.remove());
  document.head.querySelectorAll('style[data-maytes-checkout-button-overlay-styles]').forEach((el) => el.remove());
}
