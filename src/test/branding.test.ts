import { describe, it, expect } from 'vitest';
import { buildMaytesLogo } from '../branding.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

describe('buildMaytesLogo', () => {
  it('returns an SVG element in the SVG namespace with the documented viewBox', () => {
    const svg = buildMaytesLogo('2rem', '#000000');
    expect(svg.namespaceURI).toBe(SVG_NS);
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 1199.47 289.04');
    expect(svg.getAttribute('xmlns')).toBe(SVG_NS);
  });

  it('maps height/color arguments onto style.height/style.color', () => {
    const svg = buildMaytesLogo('2.75rem', 'rgb(1, 2, 3)');
    expect(svg.style.height).toBe('2.75rem');
    expect(svg.style.width).toBe('auto');
    expect(svg.style.color).toBe('rgb(1, 2, 3)');
  });

  it('renders one namespaced <path> per source path, each filled with currentColor', () => {
    const svg = buildMaytesLogo('1em', 'currentColor');
    const paths = svg.querySelectorAll('path');
    expect(paths.length).toBeGreaterThan(0);
    paths.forEach((path) => {
      expect(path.namespaceURI).toBe(SVG_NS);
      expect(path.getAttribute('fill')).toBe('currentColor');
      expect(path.getAttribute('d')?.length).toBeGreaterThan(0);
    });
  });

  it('creates independent SVG instances on repeated calls (no shared/mutated state)', () => {
    const first = buildMaytesLogo('1em', 'red');
    const second = buildMaytesLogo('2em', 'blue');
    expect(first).not.toBe(second);
    expect(first.style.height).toBe('1em');
    expect(second.style.height).toBe('2em');
  });
});
