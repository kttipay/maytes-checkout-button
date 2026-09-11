import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { 'checkout-button': 'src/index.ts' },
    format: ['iife'],
    globalName: 'MaytesCheckoutButton',
    target: 'es2020',
    platform: 'browser',
    sourcemap: true,
    minify: true,
    clean: true,
    dts: false,
    outExtension: () => ({ js: '.js' }),
    footer: { js: 'window.Maytes = MaytesCheckoutButton.Maytes;' },
  },
  {
    entry: { 'checkout-button': 'src/index.ts' },
    format: ['esm', 'cjs'],
    target: 'es2020',
    platform: 'browser',
    sourcemap: true,
    minify: false,
    clean: false,
    dts: true,
    outExtension: ({ format }) => ({ js: format === 'esm' ? '.mjs' : '.cjs' }),
  },
]);
