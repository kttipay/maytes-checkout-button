import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Maytes } from '../index.js';
import { foundation } from '../foundation/brand.generated.js';
import { resetMaytesDomForTests } from './reset-dom.js';

type Specificity = readonly [number, number, number];

interface Declaration {
  readonly property: string;
  readonly value: string;
  readonly specificity: Specificity;
  readonly order: number;
}

interface Rule {
  readonly selector: string;
  readonly declarations: ReadonlyArray<readonly [string, string]>;
}

const STATE_ATTRIBUTES: ReadonlyArray<readonly [RegExp, string]> = [
  [/:focus-visible/g, '[data-test-focus-visible]'],
  [/:hover/g, '[data-test-hover]'],
  [/:focus/g, '[data-test-focus]'],
  [/:active/g, '[data-test-active]'],
];

const STOREFRONT_AND_FRIENDS = `
*{transition:all .2s}
button{background-color:#eeeeee;border-color:#eeeeee;color:#333333}
button:hover{background-color:#d5d5d5;border-color:#d5d5d5;color:#333333}
button:focus{outline:2px solid #7f54b3}
[type=button]:hover,[type=button]:focus,button:hover,button:focus{background-color:#cc3366;color:#ffffff;text-decoration:none}
.elementor-kit-5 button:hover{color:#000000;background-color:#cccccc;box-shadow:0 0 4px #000000}
.elementor-kit-5 button:focus{box-shadow:0 0 0 3px #7f54b3;outline:3px solid #7f54b3}
.entry-content button:active{transform:translateY(1px);opacity:.8;filter:brightness(.9)}
.entry-content button:hover{text-shadow:0 1px 0 #000000;border:2px solid #333333}
.woocommerce button.button:hover{background-color:#dcd7e2;color:#515151}
.wp-block-button__link:hover{color:#333333;text-decoration:underline}
svg path{fill:#333333}
button:hover svg,button:hover svg path{transition:all .3s;animation:pulse 1s}
`;

function splitSelectorList(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of list) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim() !== '') parts.push(current.trim());
  return parts;
}

function addSpecificity(a: Specificity, b: Specificity): Specificity {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function compareSpecificity(a: Specificity, b: Specificity): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function specificityOf(selector: string): Specificity {
  let total: Specificity = [0, 0, 0];
  let rest = selector;
  rest = rest.replace(/:(not|is|has)\(([^()]*)\)/g, (_, _name: string, inner: string) => {
    const argument = splitSelectorList(inner)
      .map(specificityOf)
      .reduce((max, next) => (compareSpecificity(next, max) > 0 ? next : max), [0, 0, 0] as Specificity);
    total = addSpecificity(total, argument);
    return ' ';
  });
  rest = rest.replace(/:where\([^()]*\)/g, ' ');
  rest = rest.replace(/\[[^\]]*\]/g, () => {
    total = addSpecificity(total, [0, 1, 0]);
    return ' ';
  });
  rest = rest.replace(/::[\w-]+/g, () => {
    total = addSpecificity(total, [0, 0, 1]);
    return ' ';
  });
  rest = rest.replace(/#[\w-]+/g, () => {
    total = addSpecificity(total, [1, 0, 0]);
    return ' ';
  });
  rest = rest.replace(/[.:][\w-]+/g, () => {
    total = addSpecificity(total, [0, 1, 0]);
    return ' ';
  });
  const typeSelectors = rest.split(/[\s>+~]+/).filter((token) => /^[a-zA-Z][\w-]*$/.test(token));
  return addSpecificity(total, [0, 0, typeSelectors.length]);
}

function parseRules(css: string): Rule[] {
  const flat = css
    .replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '')
    .replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');
  const rules: Rule[] = [];
  for (const [, selectorList = '', body = ''] of flat.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const declarations = body
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part !== '')
      .map((part) => {
        const colon = part.indexOf(':');
        return [part.slice(0, colon).trim(), part.slice(colon + 1).trim()] as const;
      });
    for (const selector of splitSelectorList(selectorList)) {
      rules.push({ selector, declarations });
    }
  }
  return rules;
}

function asStateAttributes(selector: string): string {
  return STATE_ATTRIBUTES.reduce((current, [pattern, attribute]) => current.replace(pattern, attribute), selector);
}

function cascade(element: Element, rules: readonly Rule[], properties: readonly string[]): string | undefined {
  let winner: Declaration | undefined;
  rules.forEach((rule, order) => {
    if (rule.selector.includes('::')) return;
    if (!element.matches(asStateAttributes(rule.selector))) return;
    const specificity = specificityOf(rule.selector);
    for (const [property, value] of rule.declarations) {
      if (!properties.includes(property)) continue;
      const candidate: Declaration = { property, value, specificity, order };
      if (
        winner === undefined ||
        compareSpecificity(specificity, winner.specificity) > 0 ||
        (compareSpecificity(specificity, winner.specificity) === 0 && order >= winner.order)
      ) {
        winner = candidate;
      }
    }
  });
  return winner?.value;
}

function injectedSdkCss(): string {
  return [...document.head.querySelectorAll('style[data-maytes-checkout-button]')]
    .map((style) => style.textContent ?? '')
    .join('\n');
}

function setStates(button: HTMLElement, states: readonly string[]): void {
  for (const state of ['hover', 'focus', 'focus-visible', 'active']) {
    button.toggleAttribute(`data-test-${state}`, states.includes(state));
  }
}

describe('specificity helper', () => {
  it('counts ids, classes, attributes, pseudo-classes and types like the CSS spec', () => {
    expect(specificityOf('button:hover')).toEqual([0, 1, 1]);
    expect(specificityOf('[type=button]:hover')).toEqual([0, 2, 0]);
    expect(specificityOf('.woocommerce button.button:hover')).toEqual([0, 3, 1]);
    expect(specificityOf('#page .x a::before')).toEqual([1, 1, 2]);
    expect(specificityOf('.a.a:focus:not(:focus-visible)')).toEqual([0, 4, 0]);
    expect(specificityOf('*')).toEqual([0, 0, 0]);
  });
});

describe('button keeps its look under host theme button styles', () => {
  let host: HTMLDivElement;
  let rules: Rule[];
  let button: HTMLButtonElement;

  beforeEach(() => {
    resetMaytesDomForTests();
    host = document.createElement('div');
    host.className = 'entry-content elementor-kit-5 woocommerce';
    document.body.appendChild(host);
    Maytes({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' }).renderButton(host);
    button = host.querySelector('button')!;
    rules = [...parseRules(injectedSdkCss()), ...parseRules(STOREFRONT_AND_FRIENDS)];
  });

  afterEach(() => {
    host.remove();
    resetMaytesDomForTests();
  });

  const paint = (states: readonly string[], properties: readonly string[]): string | undefined => {
    setStates(button, states);
    return cascade(button, rules, properties);
  };

  const states = [
    [],
    ['hover'],
    ['focus'],
    ['focus', 'focus-visible'],
    ['active'],
    ['hover', 'focus', 'active'],
  ].map((active) => ({ name: active.join(' + ') || 'rest', active }));

  it.each(states)('keeps the brand text colour ($name)', ({ active }) => {
    expect(paint(active, ['color'])).toBe(foundation.text.primaryInverse);
  });

  it.each(states)('keeps a borderless, unshadowed, untransformed button ($name)', ({ active }) => {
    expect(paint(active, ['border', 'border-color'])).toBe('none');
    expect(paint(active, ['box-shadow'])).toBe('none');
    expect(paint(active, ['text-decoration'])).toBe('none');
    expect(paint(active, ['text-shadow'])).toBe('none');
    expect(paint(active, ['transform'])).toBe('none');
    expect(paint(active, ['filter'])).toBe('none');
    expect(paint(active, ['opacity'])).toBe('1');
    expect(paint(active, ['transition'])).toBe('background-color 120ms ease, opacity 120ms ease');
  });

  it('uses the brand background at rest, on focus and on press, and the burgundy 700 shade on hover', () => {
    const background = ['background', 'background-color'];
    expect(paint([], background)).toBe(foundation.brand.primary);
    expect(paint(['focus'], background)).toBe(foundation.brand.primary);
    expect(paint(['active'], background)).toBe(foundation.brand.primary);
    expect(paint(['hover'], background)).toBe(foundation.palette.burgundy[700]);
    expect(paint(['hover', 'active'], background)).toBe(foundation.palette.burgundy[700]);
  });

  it('drops the host focus outline for pointer focus and keeps the Maytes ring for keyboard focus', () => {
    const outline = ['outline', 'outline-style', 'outline-color'];
    expect(paint(['focus'], outline)).toBe('none');
    expect(paint(['focus', 'focus-visible'], outline)).toBe('2px solid #6b8aff');
  });

  it('keeps the busy opacity while hovered', () => {
    button.setAttribute('aria-disabled', 'true');
    expect(paint(['hover'], ['opacity'])).toBe('0.7');
    expect(paint(['hover'], ['cursor'])).toBe('progress');
    expect(paint(['hover'], ['color'])).toBe(foundation.text.primaryInverse);
  });

  it('keeps host transitions, animations and fills off the logo', () => {
    setStates(button, ['hover']);
    const logo = button.querySelector('svg')!;
    const paths = [...logo.querySelectorAll('path')];
    expect(paths.length).toBeGreaterThan(0);
    for (const part of [logo, ...paths]) {
      expect(cascade(part, rules, ['transition'])).toBe('none');
      expect(cascade(part, rules, ['animation'])).toBe('none');
    }
    for (const path of paths) {
      expect(cascade(path, rules, ['fill'])).toBe('currentColor');
    }
  });

  it('leaves the spinner animation running', () => {
    const spinner = document.createElement('span');
    spinner.className = 'maytes-checkout-button__spinner';
    button.appendChild(spinner);
    setStates(button, ['hover']);
    expect(cascade(spinner, rules, ['animation'])).toMatch(/^maytes-checkout-button-spin /);
    expect(cascade(spinner, rules, ['transition'])).toBe('none');
  });

  it('keeps the reduced-motion rule that stops the spinner', () => {
    expect(injectedSdkCss()).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.maytes-checkout-button__spinner\s*\{\s*animation: none;/,
    );
  });
});

describe('overlay link keeps its look under host theme button styles', () => {
  it('stays a transparent, borderless text link on hover and focus', () => {
    resetMaytesDomForTests();
    const host = document.createElement('div');
    document.body.appendChild(host);
    Maytes({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' }).renderButton(host);
    const rules = [...parseRules(injectedSdkCss()), ...parseRules(STOREFRONT_AND_FRIENDS)];
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'maytes-checkout-overlay__link';
    document.body.appendChild(link);
    for (const active of [[], ['hover'], ['focus'], ['active']] as const) {
      setStates(link, active);
      expect(cascade(link, rules, ['background', 'background-color'])).toBe('none');
      expect(cascade(link, rules, ['border', 'border-color'])).toBe('none');
      expect(cascade(link, rules, ['box-shadow'])).toBe('none');
      expect(cascade(link, rules, ['text-decoration'])).toBe('underline');
    }
    setStates(link, ['hover']);
    expect(cascade(link, rules, ['color'])).toBe(foundation.text.primaryInverse);
    setStates(link, []);
    expect(cascade(link, rules, ['color'])).toBe('rgba(255, 255, 255, 0.7)');
    link.remove();
    host.remove();
    resetMaytesDomForTests();
  });
  it('keeps a Maytes focus ring on the link for keyboard users when the theme swaps outlines for a shadow', () => {
    resetMaytesDomForTests();
    const host = document.createElement('div');
    document.body.appendChild(host);
    Maytes({ createCheckout: async () => ({ checkoutId: 'x' }), environment: 'sandbox' }).renderButton(host);
    const shadowFocusTheme = 'button:focus { outline: none; box-shadow: 0 0 0 3px #7f54b3; }';
    const rules = [...parseRules(injectedSdkCss()), ...parseRules(shadowFocusTheme)];
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'maytes-checkout-overlay__link';
    document.body.appendChild(link);
    const outline = ['outline', 'outline-style', 'outline-color'];
    setStates(link, ['focus', 'focus-visible']);
    expect(cascade(link, rules, outline)).toBe('2px solid #6b8aff');
    setStates(link, ['focus']);
    expect(cascade(link, rules, outline)).toBe('none');
    link.remove();
    host.remove();
    resetMaytesDomForTests();
  });
});
