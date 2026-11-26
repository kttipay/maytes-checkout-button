# Plain HTML (script tag)

For server-rendered pages (PHP, Rails, Django, Laravel, WordPress) or any page without a bundler.

```html
<div id="maytes-button"></div>

<script src="https://js.maytes.co/v1/checkout-button.js" crossorigin="anonymous"></script>
<script>
  const maytes = window.Maytes({
    environment: 'sandbox',
    createCheckout: async () => {
      const res = await fetch('/api/maytes/checkout', { method: 'POST' });
      if (!res.ok) throw new Error('Could not create the Maytes checkout');
      return res.json(); // { checkoutId, checkoutUrl }
    },
  });

  maytes.renderButton(document.getElementById('maytes-button'), { block: true });
</script>
```

- Keep the two scripts in this order, both without `async`.
- `/v1/` always serves the newest `1.x` release. To pin a tested build with SRI, use a pinned URL from the README's "Install" section and its `integrity` value from the CHANGELOG.
- If the page sets a CSP, allow `https://js.maytes.co` in `script-src`, and in `connect-src` if the policy restricts connections.
